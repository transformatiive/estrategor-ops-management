import type { FastifyInstance } from "fastify";
import {
  DOCUMENT_TAXONOMY,
  daysBetween,
  deriveChecklistStatus,
  isDelivered,
  type FollowupDTO,
  type ProjectTrackingDTO,
  type ReminderState,
  type TrackingItemDTO,
  type UrgentDeadlineDTO,
} from "@estrategor/shared";

import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireAuth } from "../auth/guards.js";
import { processDueReminders } from "../seguimento/service.js";

function nameOf(key: string): string {
  return DOCUMENT_TAXONOMY.find((d) => d.key === key)?.name ?? key;
}

export async function seguimentoRoutes(app: FastifyInstance) {
  // ── Cron protegido por token (Railway cron / n8n) — NÃO exige sessão ──
  app.post("/api/cron/reminders", async (req, reply) => {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-cron-token"] as string | undefined);
    if (token !== env.CRON_TOKEN) {
      return reply.code(401).send({ error: "Token de cron inválido." });
    }
    const result = await processDueReminders();
    return { ok: true, ...result };
  });

  // ── Endpoints com sessão ──
  app.register(async (priv) => {
    priv.addHook("preHandler", requireAuth);

    // F-01 — checklist verde/vermelho + estado dos lembretes do projecto
    priv.get<{ Params: { id: string } }>("/api/projects/:id/tracking", async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

      // pedidos de recolha do projecto — fonte da checklist (TRNSF-1069).
      const links = await prisma.collectionLink.findMany({
        where: { projectId: project.id },
        include: { reminders: { orderBy: { attemptNo: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      // TRNSF-1050 — o estado da checklist é DERIVADO dos documentos do projecto,
      // para refletir sempre a realidade: arquivado → VALIDADO (verde); na fila
      // (a_validar/em_analise) → RECEBIDO (amarelo); senão EM_FALTA (vermelho).
      // Um documento mapeia a um tipo pelo tipo confirmado (arquivado) ou, na fila,
      // pelo tipo proposto pela IA.
      const docs = await prisma.document.findMany({
        where: { projectId: project.id, status: { in: ["arquivado", "a_validar", "em_analise"] } },
        orderBy: { createdAt: "desc" },
      });
      const docsByType = new Map<string, typeof docs>();
      for (const d of docs) {
        const typeId = d.status === "arquivado" ? d.documentTypeId : d.documentTypeId ?? d.proposedTypeId;
        if (!typeId) continue;
        const arr = docsByType.get(typeId) ?? [];
        arr.push(d);
        docsByType.set(typeId, arr);
      }

      // TRNSF-1069 — a checklist mostra SÓ os documentos pedidos (união dos
      // requestedKeys dos pedidos), mais os tipos que já chegaram (para não
      // esconder o que foi recebido). Sem pedidos nem documentos, fica vazia.
      const checklistKeys = new Set<string>();
      for (const l of links) for (const k of l.requestedKeys) checklistKeys.add(k);
      const docTypeIds = [...docsByType.keys()];
      const typesFromDocs = docTypeIds.length
        ? await prisma.documentType.findMany({ where: { id: { in: docTypeIds } } })
        : [];
      for (const dt of typesFromDocs) checklistKeys.add(dt.key);
      const docTypes = checklistKeys.size
        ? await prisma.documentType.findMany({ where: { key: { in: [...checklistKeys] } } })
        : [];

      const tracking: TrackingItemDTO[] = docTypes.map((dt) => {
        const typeDocs = docsByType.get(dt.id) ?? [];
        const status = deriveChecklistStatus(typeDocs.map((d) => d.status));
        const doc = typeDocs.find((d) => d.status === "arquivado") ?? typeDocs[0];
        return {
          documentTypeKey: dt.key,
          documentTypeName: dt.name,
          status,
          delivered: isDelivered(status),
          documentId: doc?.id ?? null,
          workdriveUrl: doc?.workdriveUrl ?? null,
        };
      });

      // estado dos lembretes por pedido
      const receivedKeys = new Set(
        tracking.filter((t) => t.delivered).map((t) => t.documentTypeKey),
      );
      const followups: FollowupDTO[] = links.map((l) => ({
        collectionLinkId: l.id,
        status: l.status,
        clientEmail: l.clientEmail,
        missing: l.requestedKeys.filter((k) => !receivedKeys.has(k)).map(nameOf),
        reminders: l.reminders.map((r) => ({
          round: r.attemptNo,
          scheduledFor: r.scheduledFor.toISOString(),
          sentAt: r.sentAt?.toISOString() ?? null,
          state: r.status as ReminderState,
        })),
      }));

      const delivered = tracking.filter((t) => t.delivered).length;
      const dto: ProjectTrackingDTO = {
        items: tracking,
        total: tracking.length,
        delivered,
        complete: tracking.length > 0 && delivered === tracking.length,
        followups,
      };
      return dto;
    });

    // F-04/F — prazos urgentes (dashboard + vista Prazos): deadlines + recolhas em atraso
    priv.get("/api/deadlines/urgent", async () => {
      const now = new Date();
      const out: UrgentDeadlineDTO[] = [];

      // (a) deadlines do projeto
      const deadlines = await prisma.deadline.findMany({
        where: { status: { not: "completado" } },
        include: { project: { include: { client: true } } },
        orderBy: { dueDate: "asc" },
      });
      for (const d of deadlines) {
        const overdue = daysBetween(d.dueDate, now);
        const upcoming = daysBetween(now, d.dueDate);
        const isPast = d.dueDate < now;
        out.push({
          kind: "deadline",
          projectId: d.projectId,
          projectTitle: d.project.title,
          clientName: d.project.client.name,
          label: d.label,
          dueDate: d.dueDate.toISOString(),
          daysOverdue: isPast ? overdue : -upcoming,
          severity: isPast ? "atrasado" : upcoming <= 7 ? "urgente" : "proximo",
        });
      }

      // (b) recolhas com lembretes enviados/escalados e ainda em falta
      const escalated = await prisma.reminder.findMany({
        where: { status: { in: ["ENVIADO", "ESCALADO"] } },
        include: {
          collectionLink: true,
          project: { include: { client: true } },
        },
        orderBy: { sentAt: "desc" },
      });
      const seen = new Set<string>();
      for (const r of escalated) {
        if (!r.collectionLink || r.collectionLink.status === "USADO") continue;
        if (seen.has(r.collectionLinkId ?? "")) continue;
        seen.add(r.collectionLinkId ?? "");
        const daysSince = r.sentAt ? daysBetween(r.sentAt, now) : 0;
        out.push({
          kind: "recolha",
          projectId: r.projectId,
          projectTitle: r.project.title,
          clientName: r.project.client.name,
          label: `Recolha pendente (ronda ${r.attemptNo})`,
          dueDate: r.sentAt?.toISOString() ?? null,
          daysOverdue: daysSince,
          severity: r.status === "ESCALADO" ? "atrasado" : "urgente",
        });
      }

      // mais atrasados primeiro
      out.sort((a, b) => b.daysOverdue - a.daysOverdue);
      return out;
    });
  });
}
