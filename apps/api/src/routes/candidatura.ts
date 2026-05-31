import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CAND_COMMON_SECTIONS,
  CAND_FAMILIES_V0,
  CAND_FAMILY_LABELS,
  commonSection,
  isFieldFinal,
  type CandidaturaDTO,
  type CandFieldDTO,
  type CandSectionDTO,
  type FieldOrigin,
  type FieldState,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { versionGeneratedEdit } from "../generation/engine.js";

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

  let total = 0;
  let finalised = 0;
  const sections: CandSectionDTO[] = orderedKeys.map((key) => {
    const def = commonSection(key);
    const rows = bySection.get(key) ?? [];
    const fields = rows.map(toFieldDTO);
    const secFinal = rows.filter((f) => isFieldFinal(f.origin, f.state)).length;
    total += rows.length;
    finalised += secFinal;
    return {
      key,
      name: def?.name ?? key,
      sgoRef: def
        ? ((def.sgo as Record<string, string | undefined>)[cand.family] ?? null)
        : null,
      fields,
      total: rows.length,
      finalised: secFinal,
    };
  });

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
}
