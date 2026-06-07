import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canManageUsers,
  computeMerit,
  gridRegions,
  verificarCondicaoAcesso,
  type AvisoElegibilidade,
  type AvisoOpcaoDTO,
  type ConditionStateDTO,
  type DadosAcesso,
  type DiagnosticDTO,
  type DiagnosticResult,
  type GeoEmpresa,
  type MeritGridData,
  type MeritGridSummaryDTO,
  type PreDiagCampo,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { extrairElegibilidadeDoAviso } from "../extraction/aviso.js";

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

const eligSchema = z.object({
  caeElegiveis: z.array(z.string()).default([]),
  nuts2Elegiveis: z.array(z.string()).default([]),
  exigeBaixaDensidade: z.boolean().default(false),
  naturezasElegiveis: z.array(z.string()).default([]),
  estado: z.enum(["por_validar", "validado"]).default("por_validar"),
  notas: z.string().nullable().optional(),
  fonteUrl: z.string().nullable().optional(),
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

type GridRow = Awaited<ReturnType<typeof findGridForProject>>;

/** Resolve o aviso (grelha) do projeto: prefere o escolhido EXPLICITAMENTE
 *  (TRNSF-1031); na ausência, recai na heurística (apenas sugestão). */
async function resolveGrid(
  project: { measureLabel: string | null; program: { code: string } },
  meritGridId: string | null,
): Promise<GridRow> {
  if (meritGridId) {
    const chosen = await prisma.meritGrid.findFirst({
      where: { id: meritGridId, programCode: project.program.code },
    });
    if (chosen) return chosen;
  }
  return findGridForProject(project);
}

/** Avisos (grelhas) disponíveis no programa, para o consultor escolher. */
async function listAvisos(programCode: string): Promise<AvisoOpcaoDTO[]> {
  const grids = await prisma.meritGrid.findMany({
    where: { programCode, extracted: true },
    orderBy: [{ measure: "asc" }, { codigoAviso: "asc" }],
    select: { id: true, codigoAviso: true, measure: true, regiao: true, versao: true, eligibilidade: true },
  });
  return grids.map((g) => {
    const e = lerElegibilidade(g.eligibilidade);
    return {
      id: g.id,
      codigoAviso: g.codigoAviso,
      measure: g.measure,
      regiao: g.regiao,
      versao: g.versao,
      eligibilidadeEstado: e ? e.estado : "nenhuma",
    };
  });
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

/** Extrai do pré-diagnóstico (TRNSF-967) os dados relevantes para as condições
 *  de acesso. Só dados recolhidos; ausência → campos vazios (sem invenção). */
async function dadosAcessoDoProjeto(projectId: string): Promise<DadosAcesso> {
  const row = await prisma.preDiagnostico.findUnique({ where: { projectId }, select: { campos: true } });
  const campos = Array.isArray(row?.campos) ? (row!.campos as unknown as PreDiagCampo[]) : [];
  const valor = (key: string): string | null => {
    const c = campos.find((x) => x.key === key);
    return c && c.value != null ? String(c.value) : null;
  };
  return {
    cae: valor("cae_principal") ?? valor("cae_provavel"),
    concelho: valor("concelho"),
    distrito: valor("distrito"),
    naturezaJuridica: valor("natureza_juridica"),
    setor: valor("setor"),
  };
}

/** Resolve a geografia da empresa (NUTS II + baixa densidade) a partir do
 *  concelho recolhido, via CatalogoGeo (TRNSF-953). Sem concelho → vazio. */
async function geoDoConcelho(concelho: string | null): Promise<GeoEmpresa | null> {
  if (!concelho?.trim()) return null;
  const row = await prisma.catalogoGeo.findFirst({
    where: { concelho: { equals: concelho.trim(), mode: "insensitive" } },
    select: { nuts2: true, baixaDensidade: true },
  });
  if (!row) return { nuts2: null, baixaDensidade: null };
  return { nuts2: row.nuts2, baixaDensidade: row.baixaDensidade };
}

/** Lê a elegibilidade estruturada do aviso (defensivo). */
function lerElegibilidade(raw: unknown): AvisoElegibilidade | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  return {
    caeElegiveis: arr(e.caeElegiveis),
    nuts2Elegiveis: arr(e.nuts2Elegiveis),
    exigeBaixaDensidade: e.exigeBaixaDensidade === true,
    naturezasElegiveis: arr(e.naturezasElegiveis),
    estado: e.estado === "validado" ? "validado" : "por_validar",
    notas: typeof e.notas === "string" ? e.notas : null,
    fonteUrl: typeof e.fonteUrl === "string" ? e.fonteUrl : null,
  };
}

/** Anexa a sugestão (determinística onde possível) a cada condição; não altera
 *  o estado, que continua a ser do consultor. */
function enriquecerCondicoes(
  conditions: ConditionStateDTO[],
  dados: DadosAcesso,
  elig: AvisoElegibilidade | null,
  geo: GeoEmpresa | null,
): ConditionStateDTO[] {
  return conditions.map((c) => {
    const s = verificarCondicaoAcesso(c.label, dados, elig, geo);
    return { ...c, sugestao: s?.sugestao ?? null, sugestaoNota: s?.nota ?? null };
  });
}

async function buildDTO(projectId: string): Promise<DiagnosticDTO | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { program: true },
  });
  if (!project) return null;

  const diag = await prisma.diagnostic.findUnique({ where: { projectId } });
  const avisoConfirmado = diag?.avisoConfirmado ?? false;
  const grid = await resolveGrid(project, diag?.meritGridId ?? null);

  const baseConditions: ConditionStateDTO[] =
    (diag?.conditions as ConditionStateDTO[] | null) ??
    ((grid?.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      status: "NA" as const,
    }));
  // Pré-análise recalculada na leitura (reflete o pré-diagnóstico atual + a
  // elegibilidade estruturada do aviso, quando validada).
  const dados = await dadosAcessoDoProjeto(projectId);
  const eligibilidade = lerElegibilidade(grid?.eligibilidade);
  const geo = await geoDoConcelho(dados.concelho ?? null);
  const conditions = enriquecerCondicoes(baseConditions, dados, eligibilidade, geo);

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
    eligibilidade,
    selectedGridId: grid?.id ?? null,
    avisoConfirmado,
    avisos: await listAvisos(project.program.code),
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

  // TRNSF-1031 — ligar EXPLICITAMENTE o projeto a um aviso (grelha) do programa.
  // É a escolha que dá a certeza de que o cliente está no aviso certo; sem ela
  // o diagnóstico não avança. Mudar de aviso repõe as condições de acesso.
  app.put<{ Params: { id: string }; Body: { meritGridId?: string } }>(
    "/api/projects/:id/diagnostic/aviso",
    async (req, reply) => {
      const meritGridId = typeof req.body?.meritGridId === "string" ? req.body.meritGridId : null;
      if (!meritGridId) return reply.code(400).send({ error: "Indique o aviso a associar." });
      const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { program: true } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      const grid = await prisma.meritGrid.findFirst({
        where: { id: meritGridId, programCode: project.program.code },
      });
      if (!grid) return reply.code(400).send({ error: "Aviso inválido para o programa deste projeto." });

      const current = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });
      const mudouAviso = current?.meritGridId !== grid.id;
      // Ao trocar de aviso, as condições de acesso passam a ser as do novo aviso.
      const conditions = mudouAviso
        ? ((grid.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
            key: c.key, label: c.label, status: "NA" as const,
          }))
        : (current?.conditions ?? []);

      await prisma.diagnostic.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          programId: project.programId,
          meritGridId: grid.id,
          gridVersion: grid.versao,
          avisoConfirmado: true,
          conditions: conditions as object,
          result: "POR_INICIAR",
        },
        update: {
          meritGridId: grid.id,
          gridVersion: grid.versao,
          avisoConfirmado: true,
          ...(mudouAviso ? { conditions: conditions as object, meritInputs: undefined, meritBreakdown: undefined, mp: null, result: "EM_PREENCHIMENTO", eligible: null } : {}),
        },
      });
      return buildDTO(project.id);
    },
  );

  // TRNSF-1030 — definir/validar a elegibilidade estruturada do aviso (admin).
  // Afeta o aviso (grelha), não só este projeto — é dado do aviso.
  app.put<{ Params: { id: string } }>("/api/projects/:id/diagnostic/eligibilidade", async (req, reply) => {
    if (!canManageUsers(req.user!.role)) {
      return reply.code(403).send({ error: "Só um administrador pode definir a elegibilidade do aviso." });
    }
    const parsed = eligSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { program: true } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const diag = await prisma.diagnostic.findUnique({ where: { projectId: project.id }, select: { meritGridId: true } });
    const grid = await resolveGrid(project, diag?.meritGridId ?? null);
    if (!grid) return reply.code(409).send({ error: "Sem grelha/aviso associado — não há onde guardar a elegibilidade." });

    const elig: AvisoElegibilidade = {
      caeElegiveis: parsed.data.caeElegiveis.map((s) => s.trim()).filter(Boolean),
      nuts2Elegiveis: parsed.data.nuts2Elegiveis,
      exigeBaixaDensidade: parsed.data.exigeBaixaDensidade,
      naturezasElegiveis: parsed.data.naturezasElegiveis.map((s) => s.trim()).filter(Boolean),
      estado: parsed.data.estado,
      notas: parsed.data.notas ?? null,
      fonteUrl: parsed.data.fonteUrl ?? grid.fonteUrl ?? null,
    };
    await prisma.meritGrid.update({ where: { id: grid.id }, data: { eligibilidade: elig as object } });
    return buildDTO(project.id);
  });

  // TRNSF-1032 (Fase 2B) — importar a elegibilidade do PDF do aviso (admin).
  // Usa o fonteUrl do aviso (automático); só pede o link quando falta. A IA
  // PROPÕE como rascunho `por_validar`; o admin revê e valida. Nunca decide.
  app.post<{ Params: { id: string }; Body: { fonteUrl?: string } }>(
    "/api/projects/:id/diagnostic/eligibilidade/importar",
    async (req, reply) => {
      if (!canManageUsers(req.user!.role)) {
        return reply.code(403).send({ error: "Só um administrador pode importar a elegibilidade do aviso." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { program: true } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      const diag = await prisma.diagnostic.findUnique({ where: { projectId: project.id }, select: { meritGridId: true } });
      const grid = await resolveGrid(project, diag?.meritGridId ?? null);
      if (!grid) return reply.code(409).send({ error: "Sem grelha/aviso associado — escolha o aviso primeiro." });

      const urlInput = typeof req.body?.fonteUrl === "string" ? req.body.fonteUrl.trim() : "";
      const url = urlInput || grid.fonteUrl || "";
      if (!url) {
        return reply.code(400).send({ error: "Este aviso não tem URL do PDF — cole o link do aviso para importar." });
      }

      const { proposta } = await extrairElegibilidadeDoAviso(url);
      // Preserva uma elegibilidade já validada (a importação é uma proposta nova).
      const atual = lerElegibilidade(grid.eligibilidade);
      const elig: AvisoElegibilidade = { ...proposta, fonteUrl: url };
      await prisma.meritGrid.update({ where: { id: grid.id }, data: { eligibilidade: elig as object } });
      void atual;
      return buildDTO(project.id);
    },
  );

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

    const current = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });
    const grid = await resolveGrid(project, current?.meritGridId ?? null);

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
      if (!diag?.avisoConfirmado) {
        return reply.code(409).send({
          error: "Escolha (e confirme) o aviso do projeto antes de concluir o diagnóstico.",
        });
      }
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
