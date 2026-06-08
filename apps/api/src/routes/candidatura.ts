import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CAND_COMMON_SECTIONS,
  CAND_FAMILIES_V0,
  CAND_FAMILY_LABELS,
  commonSection,
  hasPermission,
  isDelivered,
  isFieldFinal,
  isStructuredSection,
  type CandidaturaDTO,
  type CandFieldDTO,
  type CandSectionDTO,
  type FieldOrigin,
  type FieldState,
  type RevisaoChecklistItemDTO,
  type RevisaoInternaDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { versionGeneratedEdit } from "../generation/engine.js";
import { runVerificacao } from "../verificacao/engine.js";

const startSchema = z.object({
  family: z.enum(["inovacao_produtiva", "internacionalizacao", "qualificacao"]),
  codigoAviso: z.string().optional(),
  medida: z.string().optional(),
});

const updateFieldSchema = z.object({
  section: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown().optional(),
  action: z.enum(["validar", "corrigir"]),
});

type FieldRow = {
  id: string;
  section: string;
  key: string;
  value: unknown;
  origin: FieldOrigin;
  state: FieldState;
  sourceRef: string | null;
  updatedAt: Date;
};

function toFieldDTO(f: FieldRow): CandFieldDTO {
  return {
    id: f.id,
    section: f.section,
    key: f.key,
    value: f.value ?? null,
    origin: f.origin,
    state: f.state,
    sourceRef: f.sourceRef,
    updatedAt: f.updatedAt.toISOString(),
  };
}

/** Constrói o DTO do preview, organizado pelas secções comuns da família. */
async function buildDTO(candidaturaId: string): Promise<CandidaturaDTO | null> {
  const cand = await prisma.candidatura.findUnique({
    where: { id: candidaturaId },
    include: { fields: { orderBy: [{ section: "asc" }, { key: "asc" }] } },
  });
  if (!cand) return null;

  const bySection = new Map<string, FieldRow[]>();
  for (const f of cand.fields as FieldRow[]) {
    const arr = bySection.get(f.section) ?? [];
    arr.push(f);
    bySection.set(f.section, arr);
  }

  // secções pela ordem do catálogo comum; secções extra (de famílias) no fim
  const orderedKeys = [
    ...CAND_COMMON_SECTIONS.map((s) => s.key),
    ...[...bySection.keys()].filter((k) => !CAND_COMMON_SECTIONS.some((s) => s.key === k)),
  ];

  // O resumo de proveniência conta TODOS os campos; a lista genérica do preview
  // exclui as secções estruturadas (geridas por painéis dedicados na Web) para
  // não duplicar nem mostrar JSON cru (TRNSF-1054).
  let total = 0;
  let finalised = 0;
  const sections: CandSectionDTO[] = [];
  for (const key of orderedKeys) {
    const rows = bySection.get(key) ?? [];
    const secFinal = rows.filter((f) => isFieldFinal(f.origin, f.state)).length;
    total += rows.length;
    finalised += secFinal;
    if (isStructuredSection(key)) continue; // apresentada pelo painel dedicado
    const def = commonSection(key);
    sections.push({
      key,
      name: def?.name ?? key,
      sgoRef: def
        ? ((def.sgo as Record<string, string | undefined>)[cand.family] ?? null)
        : null,
      fields: rows.map(toFieldDTO),
      total: rows.length,
      finalised: secFinal,
    });
  }

  // Ordenar pela numeração oficial do SGO da família (ex.: B mostrava
  // "18. Declarações" antes de "1. Identificação"). As secções sem número
  // (extras fora do catálogo) vão para o fim. Ordenação estável (TRNSF-1060).
  const sgoSortKey = (ref: string | null): number => {
    if (!ref) return Number.POSITIVE_INFINITY;
    const n = parseFloat(ref);
    return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
  };
  sections.sort((a, b) => sgoSortKey(a.sgoRef) - sgoSortKey(b.sgoRef));

  const pendingValidation = (cand.fields as FieldRow[]).filter(
    (f) => !isFieldFinal(f.origin, f.state),
  ).length;

  return {
    id: cand.id,
    projectId: cand.projectId,
    family: cand.family,
    familyLabel: CAND_FAMILY_LABELS[cand.family],
    stage: cand.stage,
    codigoAviso: cand.codigoAviso,
    medida: cand.medida,
    codigoProjetoSgo: cand.codigoProjetoSgo,
    sections,
    summary: { total, finalised, pendingValidation },
  };
}

// ─── Revisão interna (TRNSF-947) ──────────────────────────────────────────
type CandidaturaRow = {
  id: string;
  projectId: string;
  codigoAviso: string | null;
};

/**
 * Calcula a checklist de aprovação da revisão interna (A3). Quatro itens, cada
 * um derivado do estado real da candidatura. Reutilizado pelo GET (vista) e
 * pelos POST de aprovar/devolver (snapshot guardado na decisão).
 */
async function buildRevisaoChecklist(
  projectId: string,
  candidatura: CandidaturaRow,
): Promise<RevisaoChecklistItemDTO[]> {
  const itens: RevisaoChecklistItemDTO[] = [];

  // 1) Artefactos verificados — nenhum campo automático por validar.
  const porValidar = await prisma.candField.count({
    where: {
      candidaturaId: candidatura.id,
      origin: { in: ["extraido", "gerado", "api_empresas", "pre_diagnostico_ia"] },
      state: "por_validar",
    },
  });
  itens.push({
    key: "artefactos_verificados",
    label: "Artefactos verificados",
    status: porValidar === 0 ? "ok" : "falha",
    detalhe: porValidar === 0 ? "Sem campos automáticos por validar." : `${porValidar} campo(s) por validar.`,
  });

  // 2) Mérito ≥ mínimo — corre o verificador (determinístico).
  const verif = await runVerificacao(projectId);
  if (!verif || verif.atingeMinimo === null) {
    itens.push({
      key: "merito_minimo",
      label: "Mérito ≥ mínimo",
      status: "indeterminado",
      detalhe: "Sem grelha de mérito — MP não calculado.",
    });
  } else if (verif.atingeMinimo === true) {
    itens.push({
      key: "merito_minimo",
      label: "Mérito ≥ mínimo",
      status: "ok",
      detalhe: `MP ${verif.mpPrevisto ?? "?"} ≥ ${verif.mpMinimo ?? "?"}.`,
    });
  } else {
    itens.push({
      key: "merito_minimo",
      label: "Mérito ≥ mínimo",
      status: "falha",
      detalhe: `MP ${verif.mpPrevisto ?? "?"} < ${verif.mpMinimo ?? "?"}.`,
    });
  }

  // 3) Documentos obrigatórios — todos os itens da checklist entregues.
  const checklistItems = await prisma.checklistItem.findMany({
    where: { projectId },
    select: { status: true },
  });
  if (checklistItems.length === 0) {
    itens.push({
      key: "documentos_obrigatorios",
      label: "Documentos obrigatórios",
      status: "indeterminado",
      detalhe: "Sem checklist de documentos.",
    });
  } else {
    const emFalta = checklistItems.filter((c) => !isDelivered(c.status)).length;
    itens.push({
      key: "documentos_obrigatorios",
      label: "Documentos obrigatórios",
      status: emFalta === 0 ? "ok" : "falha",
      detalhe: emFalta === 0 ? "Todos os documentos entregues." : `${emFalta} documento(s) em falta.`,
    });
  }

  // 4) Prazo do aviso — o aviso da candidatura ainda está aberto.
  const now = new Date();
  let prazo: RevisaoChecklistItemDTO = {
    key: "prazo_aviso",
    label: "Prazo do aviso",
    status: "indeterminado",
    detalhe: "Sem aviso/prazo associado.",
  };
  if (candidatura.codigoAviso) {
    const aviso = await prisma.aviso.findFirst({
      where: { measure: candidatura.codigoAviso },
    });
    if (aviso?.closeDate) {
      const fecha = aviso.closeDate.toLocaleDateString("pt-PT");
      prazo = aviso.closeDate >= now
        ? { key: "prazo_aviso", label: "Prazo do aviso", status: "ok", detalhe: `Fecha em ${fecha}.` }
        : { key: "prazo_aviso", label: "Prazo do aviso", status: "falha", detalhe: "Prazo expirado." };
    }
  }
  itens.push(prazo);

  return itens;
}

/** Monta o DTO completo do painel de revisão interna (A3). */
async function buildRevisaoDTO(
  projectId: string,
  candidatura: CandidaturaRow & { stage: "A2" | "A3" | "A4" },
  podePermissao: boolean,
): Promise<RevisaoInternaDTO> {
  const checklist = await buildRevisaoChecklist(projectId, candidatura);
  const historicoRows = await prisma.revisaoInterna.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { revisor: { select: { fullName: true } } },
  });
  return {
    stage: candidatura.stage,
    checklist,
    podeAprovar: podePermissao && candidatura.stage === "A3",
    bloqueios: checklist.filter((i) => i.status === "falha").length,
    historico: historicoRows.map((r) => ({
      id: r.id,
      resultado: r.resultado as "aprovada" | "devolvida",
      comentarios: r.comentarios,
      revisorNome: r.revisor.fullName,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function candidaturaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Obter a candidatura de um projecto (ou indicar que está por iniciar)
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const cand = await prisma.candidatura.findUnique({ where: { projectId: project.id } });
    if (!cand) {
      return { candidatura: null, familyChosen: project.family ?? null };
    }
    return buildDTO(cand.id);
  });

  // Iniciar a candidatura: escolher a família. Disponível após A0 concluído.
  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura", async (req, reply) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    if (!CAND_FAMILIES_V0.includes(parsed.data.family)) {
      return reply.code(400).send({ error: "Família ainda não disponível." });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

    // A candidatura monta-se na fase A2; exige diagnóstico A0 concluído.
    const diag = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });
    const a0Done = diag && (diag.result === "ELEGIVEL" || diag.result === "A_REVER");
    if (!a0Done && project.state === "A0") {
      return reply.code(409).send({ error: "Conclua o diagnóstico A0 antes de iniciar a candidatura." });
    }

    const existing = await prisma.candidatura.findUnique({ where: { projectId: project.id } });
    if (existing) return reply.code(409).send({ error: "A candidatura já foi iniciada." });

    const cand = await prisma.$transaction(async (tx) => {
      const created = await tx.candidatura.create({
        data: {
          projectId: project.id,
          family: parsed.data.family,
          codigoAviso: parsed.data.codigoAviso ?? project.measureLabel ?? null,
          medida: parsed.data.medida ?? null,
          stage: "A2",
        },
      });
      // família fica registada no projecto; entra em A2 se estava antes
      await tx.project.update({
        where: { id: project.id },
        data: { family: parsed.data.family, ...(project.state === "A0" || project.state === "A1" ? { state: "A2" } : {}) },
      });
      if (project.state === "A0" || project.state === "A1") {
        await tx.stateTransition.create({
          data: { projectId: project.id, fromState: project.state, toState: "A2", byUserId: req.user!.id },
        });
      }
      await tx.activityLog.create({
        data: {
          projectId: project.id,
          userId: req.user!.id,
          type: "candidatura_iniciada",
          description: `Candidatura iniciada — família ${CAND_FAMILY_LABELS[parsed.data.family]}.`,
        },
      });
      return created;
    });
    return reply.code(201).send(await buildDTO(cand.id));
  });

  // Validar/corrigir um campo do preview (persiste e marca validado/corrigido)
  app.patch<{ Params: { id: string } }>("/api/projects/:id/candidatura/field", async (req, reply) => {
    const parsed = updateFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const cand = await prisma.candidatura.findUnique({ where: { projectId: req.params.id } });
    if (!cand) return reply.code(404).send({ error: "Candidatura não encontrada." });

    const field = await prisma.candField.findUnique({
      where: { candidaturaId_section_key: { candidaturaId: cand.id, section: parsed.data.section, key: parsed.data.key } },
    });
    if (!field) return reply.code(404).send({ error: "Campo não encontrado." });

    const data =
      parsed.data.action === "corrigir"
        ? { value: (parsed.data.value ?? null) as object, state: "corrigido" as const, updatedById: req.user!.id }
        : { state: "validado" as const, updatedById: req.user!.id };

    await prisma.candField.update({ where: { id: field.id }, data });

    // TRNSF-943 — editar um campo gerado versiona a edição (estado corrigido)
    if (parsed.data.action === "corrigir" && field.origin === "gerado") {
      const novo = parsed.data.value;
      if (typeof novo === "string") {
        await versionGeneratedEdit(cand.id, parsed.data.section, parsed.data.key, novo, req.user!.id);
      }
    }
    return buildDTO(cand.id);
  });

  // §8 — transição A2 → A3 (revisão interna) e devolução A3 → A2
  app.post<{ Params: { id: string }; Body: { to: "A3" | "A2" } }>(
    "/api/projects/:id/candidatura/stage",
    async (req, reply) => {
      const to = req.body?.to;
      if (to !== "A3" && to !== "A2") {
        return reply.code(400).send({ error: "Transição inválida (use A3 ou A2)." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      const cand = project && (await prisma.candidatura.findUnique({ where: { projectId: project.id } }));
      if (!project || !cand) return reply.code(404).send({ error: "Candidatura não encontrada." });

      const from = cand.stage;
      if (to === "A3" && from !== "A2") return reply.code(409).send({ error: "Só é possível submeter para revisão a partir de A2." });
      if (to === "A2" && from !== "A3") return reply.code(409).send({ error: "Só é possível devolver a partir de A3." });

      // Antes de A2→A3: nenhum campo extraido/gerado pode ficar por validar.
      if (to === "A3") {
        const pending = await prisma.candField.count({
          where: {
            candidaturaId: cand.id,
            origin: { in: ["extraido", "gerado"] },
            state: "por_validar",
          },
        });
        if (pending > 0) {
          return reply.code(409).send({
            error: `Há ${pending} campo(s) por validar (extraídos/gerados). Valide-os antes de submeter para revisão.`,
          });
        }
      }

      await prisma.$transaction([
        prisma.candidatura.update({ where: { id: cand.id }, data: { stage: to } }),
        prisma.project.update({ where: { id: project.id }, data: { state: to } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: from, toState: to, byUserId: req.user!.id },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "candidatura_stage",
            description: to === "A3" ? "Candidatura submetida para revisão interna (A3)." : "Candidatura devolvida para preparação (A2).",
          },
        }),
      ]);
      return { ok: true, stage: to };
    },
  );

  // ─── Revisão interna A3 (TRNSF-947) ─────────────────────────────────────
  // (a) Vista: checklist calculada + histórico de decisões.
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/revisao", async (req, reply) => {
    const cand = await prisma.candidatura.findUnique({ where: { projectId: req.params.id } });
    if (!cand) return reply.code(404).send({ error: "Candidatura não encontrada." });
    const pode = hasPermission(req.user!, "aprovar_revisao_interna");
    return buildRevisaoDTO(cand.projectId, cand, pode);
  });

  // (b) Aprovar → A4 (submissão). Guarda de permissão inline.
  app.post<{ Params: { id: string }; Body: { comentarios?: string } }>(
    "/api/projects/:id/candidatura/revisao/aprovar",
    async (req, reply) => {
      if (!hasPermission(req.user!, "aprovar_revisao_interna")) {
        return reply.code(403).send({ error: "Sem permissão para aprovar a revisão interna." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      const cand = project && (await prisma.candidatura.findUnique({ where: { projectId: project.id } }));
      if (!project || !cand) return reply.code(404).send({ error: "Candidatura não encontrada." });
      if (cand.stage !== "A3") {
        return reply.code(409).send({ error: "Só é possível aprovar a revisão a partir de A3." });
      }
      const parsed = z.object({ comentarios: z.string().optional() }).safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });

      const checklist = await buildRevisaoChecklist(project.id, cand);
      await prisma.$transaction([
        prisma.candidatura.update({ where: { id: cand.id }, data: { stage: "A4" } }),
        prisma.project.update({ where: { id: project.id }, data: { state: "A4" } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: "A3", toState: "A4", byUserId: req.user!.id },
        }),
        prisma.revisaoInterna.create({
          data: {
            projectId: project.id,
            resultado: "aprovada",
            checklist: checklist as object,
            comentarios: parsed.data.comentarios ?? null,
            revisorId: req.user!.id,
          },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "revisao_aprovada",
            description: "Revisão interna aprovada — candidatura pronta para submissão (A4).",
          },
        }),
      ]);
      const fresh = await prisma.candidatura.findUnique({ where: { id: cand.id } });
      return buildRevisaoDTO(project.id, fresh!, true);
    },
  );

  // (c) Devolver → A2 (preparação) com comentários obrigatórios.
  app.post<{ Params: { id: string }; Body: { comentarios: string } }>(
    "/api/projects/:id/candidatura/revisao/devolver",
    async (req, reply) => {
      if (!hasPermission(req.user!, "aprovar_revisao_interna")) {
        return reply.code(403).send({ error: "Sem permissão para aprovar a revisão interna." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      const cand = project && (await prisma.candidatura.findUnique({ where: { projectId: project.id } }));
      if (!project || !cand) return reply.code(404).send({ error: "Candidatura não encontrada." });
      if (cand.stage !== "A3") {
        return reply.code(409).send({ error: "Só é possível devolver a revisão a partir de A3." });
      }
      const parsed = z.object({ comentarios: z.string().min(1, "Indique um comentário para devolver.") }).safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Indique um comentário para devolver." });
      }

      const checklist = await buildRevisaoChecklist(project.id, cand);
      await prisma.$transaction([
        prisma.candidatura.update({ where: { id: cand.id }, data: { stage: "A2" } }),
        prisma.project.update({ where: { id: project.id }, data: { state: "A2" } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: "A3", toState: "A2", byUserId: req.user!.id },
        }),
        prisma.revisaoInterna.create({
          data: {
            projectId: project.id,
            resultado: "devolvida",
            checklist: checklist as object,
            comentarios: parsed.data.comentarios,
            revisorId: req.user!.id,
          },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "revisao_devolvida",
            description: "Revisão interna devolvida para preparação (A2) com comentários.",
          },
        }),
      ]);
      const fresh = await prisma.candidatura.findUnique({ where: { id: cand.id } });
      return buildRevisaoDTO(project.id, fresh!, true);
    },
  );
}
