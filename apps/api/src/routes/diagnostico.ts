import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  computeMerit,
  gridRegions,
  type ConditionStateDTO,
  type DiagnosticDTO,
  type DiagnosticResult,
  type MeritGridData,
  type MeritGridSummaryDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

const saveSchema = z.object({
  conditions: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        status: z.enum(["PASSA", "FALHA", "NA"]),
        note: z.string().optional(),
      }),
    )
    .optional(),
  meritSelection: z.record(z.string(), z.number().int().min(0)).optional(),
  regiao: z.string().nullable().optional(),
});

/** Procura a grelha de mérito aplicável a um projecto (por programa/medida). */
async function findGridForProject(project: {
  measureLabel: string | null;
  program: { code: string };
}) {
  // Na Semana 1 ligamos pela medida/aviso quando coincide; caso contrário, a
  // primeira grelha extraída do programa. Sem grelha → null (ecrã mostra-o).
  const grids = await prisma.meritGrid.findMany({
    where: { programCode: project.program.code, extracted: true },
    orderBy: { createdAt: "asc" },
  });
  if (grids.length === 0) return null;
  if (project.measureLabel) {
    const match = grids.find(
      (g) =>
        project.measureLabel!.toLowerCase().includes(g.codigoAviso.toLowerCase()) ||
        g.measure.toLowerCase().includes(project.measureLabel!.toLowerCase()),
    );
    if (match) return match;
  }
  return grids[0]!;
}

function gridSummary(g: {
  id: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string | null;
  mpMinimo: unknown;
  minimoPorCriterio: unknown;
  formulaMp: string | null;
}): MeritGridSummaryDTO {
  return {
    id: g.id,
    measure: g.measure,
    codigoAviso: g.codigoAviso,
    regiao: g.regiao,
    versao: g.versao,
    fonteUrl: g.fonteUrl,
    mpMinimo: g.mpMinimo === null ? null : Number(g.mpMinimo),
    minimoPorCriterio: g.minimoPorCriterio === null ? null : Number(g.minimoPorCriterio),
    formulaMp: g.formulaMp,
  };
}

/** Deriva o resultado a partir das condições + mérito (validação humana à parte). */
function deriveResult(
  conditions: ConditionStateDTO[],
  merit: ReturnType<typeof computeMerit> | null,
  hasGrid: boolean,
): { result: DiagnosticResult; eligible: boolean | null } {
  const anyFail = conditions.some((c) => c.status === "FALHA");
  const allAnswered = conditions.length > 0 && conditions.every((c) => c.status !== "NA");

  if (anyFail) return { result: "NAO_ELEGIVEL", eligible: false };
  if (!hasGrid) return { result: "SEM_GRELHA", eligible: null };
  if (!merit || merit.missing.length > 0 || !allAnswered) {
    return { result: "EM_PREENCHIMENTO", eligible: null };
  }
  if (merit.passes) return { result: "ELEGIVEL", eligible: true };
  // mérito calculado mas abaixo do mínimo → a rever (humano decide)
  return { result: "A_REVER", eligible: false };
}

async function buildDTO(projectId: string): Promise<DiagnosticDTO | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { program: true },
  });
  if (!project) return null;

  const grid = await findGridForProject(project);
  const diag = await prisma.diagnostic.findUnique({ where: { projectId } });

  const conditions: ConditionStateDTO[] =
    (diag?.conditions as ConditionStateDTO[] | null) ??
    ((grid?.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      status: "NA" as const,
    }));

  const meritSelection = (diag?.meritInputs as Record<string, number> | null) ?? {};
  const gridData = (grid?.grid as MeritGridData | null) ?? null;
  const regiao = diag?.regiao ?? null;
  const merit = gridData ? computeMerit(gridData, meritSelection, regiao) : null;

  return {
    projectId,
    programCode: project.program.code,
    result: (diag?.result as DiagnosticResult) ?? (grid ? "POR_INICIAR" : "SEM_GRELHA"),
    eligible: diag?.eligible ?? null,
    mp: merit && merit.missing.length === 0 ? merit.mp : (diag?.mp ? Number(diag.mp) : null),
    gridVersion: grid?.versao ?? null,
    regiao,
    availableRegions: gridData ? gridRegions(gridData) : [],
    conditions,
    grid: grid ? gridSummary(grid) : null,
    gridData,
    meritSelection,
    meritBreakdown: merit ?? null,
    updatedAt: diag?.updatedAt.toISOString() ?? null,
  };
}

export async function diagnosticoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // G — abrir o diagnóstico de um projecto
  app.get<{ Params: { id: string } }>("/api/projects/:id/diagnostic", async (req, reply) => {
    const dto = await buildDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Projeto não encontrado." });
    return dto;
  });

  // G — guardar condições de acesso + selecções de mérito (recalcula e persiste)
  app.put<{ Params: { id: string } }>("/api/projects/:id/diagnostic", async (req, reply) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { program: true },
    });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

    const grid = await findGridForProject(project);
    const current = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });

    const conditions =
      parsed.data.conditions ??
      (current?.conditions as ConditionStateDTO[] | null) ??
      ((grid?.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
        key: c.key,
        label: c.label,
        status: "NA" as const,
      }));
    const meritSelection =
      parsed.data.meritSelection ?? (current?.meritInputs as Record<string, number> | null) ?? {};
    const regiao =
      parsed.data.regiao !== undefined ? parsed.data.regiao : (current?.regiao ?? null);

    const gridData = (grid?.grid as MeritGridData | null) ?? null;
    const merit = gridData ? computeMerit(gridData, meritSelection, regiao) : null;
    const { result, eligible } = deriveResult(conditions, merit, Boolean(gridData));

    const saved = await prisma.diagnostic.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        programId: project.programId,
        conditions: conditions as object,
        regiao,
        meritInputs: meritSelection as object,
        meritBreakdown: (merit ?? undefined) as object | undefined,
        mp: merit && merit.missing.length === 0 ? merit.mp : null,
        meritGridId: grid?.id ?? null,
        gridVersion: grid?.versao ?? null,
        result,
        eligible,
      },
      update: {
        conditions: conditions as object,
        regiao,
        meritInputs: meritSelection as object,
        meritBreakdown: (merit ?? undefined) as object | undefined,
        mp: merit && merit.missing.length === 0 ? merit.mp : null,
        meritGridId: grid?.id ?? null,
        gridVersion: grid?.versao ?? null,
        result,
        eligible,
      },
    });
    void saved;
    return buildDTO(project.id);
  });

  // §8 — transição A0 → Candidatura (A1), só com diagnóstico concluído
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/diagnostic/advance",
    async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      if (project.state !== "A0") {
        return reply.code(409).send({ error: "O projecto não está na fase A0." });
      }
      const diag = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });
      const concluded =
        diag && (diag.result === "ELEGIVEL" || diag.result === "A_REVER");
      if (!concluded) {
        return reply.code(409).send({
          error: "Conclua o diagnóstico (acesso + mérito) antes de avançar para Candidatura.",
        });
      }
      await prisma.$transaction([
        prisma.project.update({ where: { id: project.id }, data: { state: "A1" } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: "A0", toState: "A1", byUserId: req.user!.id },
        }),
        prisma.diagnostic.update({
          where: { projectId: project.id },
          data: { decidedByUserId: req.user!.id },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "state_transition",
            description: "Diagnóstico concluído — avançou de A0 para Candidatura (A1).",
          },
        }),
      ]);
      return { ok: true, state: "A1" };
    },
  );
}
