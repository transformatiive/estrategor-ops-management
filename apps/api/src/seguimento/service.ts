import {
  DOCUMENT_TAXONOMY,
  REMINDER_ROUNDS,
  addBusinessDays,
  reminderEmail,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { getEmail } from "../email/adapter.js";

function nameOf(key: string): string {
  return DOCUMENT_TAXONOMY.find((d) => d.key === key)?.name ?? key;
}

function publicLink(token: string): string {
  return `${env.WEB_ORIGIN.replace(/\/$/, "")}/recolha/${token}`;
}

/** Documentos pedidos ainda em falta (checklist EM_FALTA) de um pedido de recolha. */
async function missingKeys(link: {
  projectId: string;
  requestedKeys: string[];
}): Promise<string[]> {
  if (link.requestedKeys.length === 0) return [];
  const types = await prisma.documentType.findMany({
    where: { key: { in: link.requestedKeys } },
  });
  const items = await prisma.checklistItem.findMany({
    where: { projectId: link.projectId, documentTypeId: { in: types.map((t) => t.id) } },
  });
  const received = new Set(
    items.filter((i) => i.status === "RECEBIDO").map((i) => i.documentTypeId),
  );
  return types.filter((t) => !received.has(t.id)).map((t) => t.key);
}

/** Agenda a 1.ª ronda de lembrete para um pedido de recolha (§9). */
export async function scheduleFirstReminder(collectionLinkId: string): Promise<void> {
  const link = await prisma.collectionLink.findUnique({ where: { id: collectionLinkId } });
  if (!link || !link.clientEmail) return; // sem email do cliente não agenda
  const round = REMINDER_ROUNDS[0]!;
  await prisma.reminder.create({
    data: {
      projectId: link.projectId,
      collectionLinkId: link.id,
      attemptNo: round.round,
      scheduledFor: addBusinessDays(link.createdAt, round.businessDays),
      status: "AGENDADO",
    },
  });
}

/** Cancela (fecha) os lembretes pendentes de um pedido — ao completar a recolha. */
export async function cancelPendingReminders(collectionLinkId: string): Promise<void> {
  await prisma.reminder.updateMany({
    where: { collectionLinkId, status: "AGENDADO" },
    data: { status: "FECHADO" },
  });
}

/**
 * Processa os lembretes vencidos (cron — TRNSF-939). Para cada lembrete AGENDADO
 * com `scheduledFor <= now`: se já não falta nada, fecha; senão envia o email da
 * ronda e agenda a ronda seguinte (até à 3.ª, que leva cópia ao consultor).
 * Devolve um resumo do processamento.
 */
export async function processDueReminders(now = new Date()): Promise<{
  processed: number;
  sent: number;
  closed: number;
}> {
  const due = await prisma.reminder.findMany({
    where: { status: "AGENDADO", scheduledFor: { lte: now } },
    include: {
      collectionLink: true,
      project: { include: { client: true, responsibles: { include: { user: true } } } },
    },
  });

  const email = getEmail();
  let sent = 0;
  let closed = 0;

  for (const r of due) {
    const link = r.collectionLink;
    if (!link || link.status === "EXPIRADO" || link.expiresAt < now) {
      await prisma.reminder.update({ where: { id: r.id }, data: { status: "FECHADO" } });
      closed += 1;
      continue;
    }
    const missing = await missingKeys(link);
    if (missing.length === 0) {
      await cancelPendingReminders(link.id);
      closed += 1;
      continue;
    }

    const roundCfg = REMINDER_ROUNDS.find((x) => x.round === r.attemptNo) ?? REMINDER_ROUNDS[0]!;
    const tpl = reminderEmail({
      round: roundCfg.round,
      projectTitle: r.project.title,
      clientName: r.project.client.name,
      link: publicLink(link.token),
      missing: missing.map(nameOf),
    });
    const cc = roundCfg.ccConsultor
      ? r.project.responsibles.map((p) => p.user.email).filter(Boolean).join(",") || undefined
      : undefined;

    if (link.clientEmail) {
      await email.send({ to: link.clientEmail, cc, subject: tpl.subject, body: tpl.body });
    }
    sent += 1;

    await prisma.reminder.update({
      where: { id: r.id },
      data: { sentAt: now, status: roundCfg.round >= 3 ? "ESCALADO" : "ENVIADO" },
    });
    await prisma.activityLog.create({
      data: {
        projectId: r.projectId,
        type: roundCfg.round >= 3 ? "reminder_escalated" : "reminder_sent",
        description:
          `Lembrete (ronda ${roundCfg.round}) ${link.clientEmail ? `enviado a ${link.clientEmail}` : "registado"}` +
          `${cc ? ` (cc consultor)` : ""} — faltam ${missing.length} documento(s) [${email.mode}].`,
      },
    });

    // agenda a ronda seguinte
    const next = REMINDER_ROUNDS.find((x) => x.round === roundCfg.round + 1);
    if (next) {
      await prisma.reminder.create({
        data: {
          projectId: r.projectId,
          collectionLinkId: link.id,
          attemptNo: next.round,
          scheduledFor: addBusinessDays(link.createdAt, next.businessDays),
          status: "AGENDADO",
        },
      });
    }
  }

  return { processed: due.length, sent, closed };
}
