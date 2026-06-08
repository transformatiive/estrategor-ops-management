import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  canManageUsers,
  hasPermission,
  classificacaoBaixaDensidade,
  computeMerit,
  freguesiaBaixaDensidade,
  gridRegions,
  regiaoGrelhaParaNuts2,
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
  type MeritProposalDTO,
  type PreDiagCampo,
  type ProjectState,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { extrairElegibilidadeDoAviso } from "../extraction/aviso.js";
import { extrairMeritoDoProjeto } from "../extraction/merito.js";

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

const encerrarSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "Indique o motivo do encerramento."),
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

/**
 * Dono do diagnóstico: ou um projeto (fluxo legado A0) ou uma lead (pré-projeto,
 * Lead/Análise). Os handlers são agnósticos ao dono; resolvem o "sujeito"
 * (título/medida/programa) a partir dele e gravam/lêem o Diagnostic via
 * `where: owner`. Espelha `PreDiagOwner` do motor de pré-diagnóstico.
 */
export type DiagOwner = { projectId: string } | { leadId: string };

/**
 * Sujeito do diagnóstico — o conjunto mínimo de dados (independente de projeto
 * ou lead) de que os helpers de grelha/mérito/elegibilidade precisam.
 * `projectState` é benigno para leads (não há máquina de estados de projeto).
 */
type DiagSubject = {
  title: string;
  measureLabel: string | null;
  program: { id: string; code: string };
  programId: string;
  projectState: ProjectState;
};

/**
 * Resolve o sujeito a partir do dono. Projeto: carrega título/medida/programa
 * como hoje. Lead: carrega cliente + programa — título = nome do cliente,
 * medida = null, programa = lead.program. Devolve null se o dono não existe.
 */
async function resolveSubject(owner: DiagOwner): Promise<DiagSubject | null> {
  if ("projectId" in owner) {
    const project = await prisma.project.findUnique({
      where: { id: owner.projectId },
      include: { program: true },
    });
    if (!project) return null;
    return {
      title: project.title,
      measureLabel: project.measureLabel,
      program: { id: project.program.id, code: project.program.code },
      programId: project.programId,
      projectState: project.state,
    };
  }
  const lead = await prisma.lead.findUnique({
    where: { id: owner.leadId },
    include: { client: true, program: true },
  });
  if (!lead) return null;
  return {
    title: lead.client.name,
    measureLabel: null,
    program: { id: lead.program.id, code: lead.program.code },
    programId: lead.programId,
    // Numa lead não há estado de projeto; valor benigno (a vista da lead não o usa).
    projectState: "A0",
  };
}

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
async function dadosAcesso(owner: DiagOwner): Promise<DadosAcesso> {
  const row = await prisma.preDiagnostico.findUnique({ where: owner, select: { campos: true } });
  const campos = Array.isArray(row?.campos) ? (row!.campos as unknown as PreDiagCampo[]) : [];
  const valor = (key: string): string | null => {
    const c = campos.find((x) => x.key === key);
    return c && c.value != null ? String(c.value) : null;
  };
  return {
    cae: valor("cae_principal") ?? valor("cae_provavel"),
    concelho: valor("concelho"),
    freguesia: valor("freguesia"),
    distrito: valor("distrito"),
    naturezaJuridica: valor("natureza_juridica"),
    setor: valor("setor"),
  };
}

/**
 * Resolve a Localização da empresa (NUTS II + baixa densidade) a partir do
 * concelho e da freguesia recolhidos (TRNSF-1040). Usa o catálogo `CatalogoGeo`
 * para o NUTS II e a classificação de baixa densidade do partilhado para o
 * tri-estado:
 *  - concelho integral             → baixaDensidade = true;
 *  - concelho não classificado     → false;
 *  - concelho parcial + freguesia  → true/false conforme a lista oficial;
 *  - concelho parcial sem freguesia → "a_confirmar" (não decide).
 * Sem concelho → vazio.
 */
async function resolverLocalizacao(
  concelho: string | null,
  freguesia: string | null,
): Promise<GeoEmpresa | null> {
  if (!concelho?.trim()) return null;
  // NUTS II vem do catálogo (linha do concelho, freguesia null).
  const row = await prisma.catalogoGeo.findFirst({
    where: { concelho: { equals: concelho.trim(), mode: "insensitive" } },
    select: { nuts2: true },
  });
  const nuts2 = row?.nuts2 ?? null;
  const resolved = freguesiaBaixaDensidade(concelho, freguesia);
  // null da helper num concelho PARCIAL = freguesia desconhecida → "a_confirmar".
  // (Em concelhos integral/nenhuma a helper devolve sempre true/false.)
  const baixaDensidade: GeoEmpresa["baixaDensidade"] =
    resolved === null && classificacaoBaixaDensidade(concelho) === "parcial" ? "a_confirmar" : resolved;
  return { nuts2, baixaDensidade };
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

/** Lê a proposta de mérito (IA) persistida no diagnóstico (defensivo). */
function lerPropostaMerito(
  proposal: unknown,
  estado: string | null,
  nota: string | null,
): MeritProposalDTO | null {
  if (!proposal || typeof proposal !== "object") return null;
  const p = proposal as Record<string, unknown>;
  const selection: Record<string, number> = {};
  if (p.selection && typeof p.selection === "object") {
    for (const [k, v] of Object.entries(p.selection as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isInteger(n) && n >= 0) selection[k] = n;
    }
  }
  const justificacoes: Record<string, string> = {};
  if (p.justificacoes && typeof p.justificacoes === "object") {
    for (const [k, v] of Object.entries(p.justificacoes as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) justificacoes[k] = v;
    }
  }
  return {
    selection,
    justificacoes,
    regiao: typeof p.regiao === "string" ? p.regiao : null,
    estado: estado === "validado" ? "validado" : "por_validar",
    nota: typeof nota === "string" ? nota : null,
  };
}

/** Monta o contexto textual do projeto (dados do pré-diagnóstico, com rótulos)
 *  para a sugestão de mérito por IA. Só dados recolhidos; ausência → linhas
 *  omitidas (sem invenção). */
async function contextoMerito(
  subject: { title: string; measureLabel: string | null },
  owner: DiagOwner,
): Promise<string> {
  const linhas: string[] = [];
  if (subject.title?.trim()) linhas.push(`Projeto: ${subject.title.trim()}`);
  if (subject.measureLabel?.trim()) linhas.push(`Medida/Aviso: ${subject.measureLabel.trim()}`);

  const row = await prisma.preDiagnostico.findUnique({ where: owner, select: { campos: true } });
  const campos = Array.isArray(row?.campos) ? (row!.campos as unknown as PreDiagCampo[]) : [];
  for (const c of campos) {
    if (c.value == null || String(c.value).trim() === "") continue;
    linhas.push(`${c.label}: ${String(c.value).trim()}`);
  }
  return linhas.join("\n");
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

async function buildDTO(owner: DiagOwner): Promise<DiagnosticDTO | null> {
  const subject = await resolveSubject(owner);
  if (!subject) return null;
  const ownerId = "projectId" in owner ? owner.projectId : owner.leadId;

  const diag = await prisma.diagnostic.findUnique({ where: owner });
  const avisoConfirmado = diag?.avisoConfirmado ?? false;
  const grid = await resolveGrid(subject, diag?.meritGridId ?? null);

  const baseConditions: ConditionStateDTO[] =
    (diag?.conditions as ConditionStateDTO[] | null) ??
    ((grid?.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      status: "NA" as const,
    }));
  // Pré-análise recalculada na leitura (reflete o pré-diagnóstico atual + a
  // elegibilidade estruturada do aviso, quando validada).
  const dados = await dadosAcesso(owner);
  const eligibilidade = lerElegibilidade(grid?.eligibilidade);
  const geo = await resolverLocalizacao(dados.concelho ?? null, dados.freguesia ?? null);
  const conditions = enriquecerCondicoes(baseConditions, dados, eligibilidade, geo);

  const meritSelection = (diag?.meritInputs as Record<string, number> | null) ?? {};
  const gridData = (grid?.grid as MeritGridData | null) ?? null;
  const regiao = diag?.regiao ?? null;
  const regioesGrelha = gridData ? gridRegions(gridData) : [];
  // Sugestão: só quando o consultor ainda não escolheu a região (diag.regiao
  // null) e a empresa tem NUTS II validado. Mapeia o NUTS II à matriz da grelha;
  // null se não houver correspondência (nunca inventa região fora da grelha).
  const regiaoSugerida =
    !regiao && gridData && geo?.nuts2
      ? regiaoGrelhaParaNuts2(geo.nuts2, regioesGrelha)
      : null;
  const merit = gridData ? computeMerit(gridData, meritSelection, regiao) : null;

  return {
    projectId: ownerId,
    programCode: subject.program.code,
    projectState: subject.projectState,
    result: (diag?.result as DiagnosticResult) ?? (grid ? "POR_INICIAR" : "SEM_GRELHA"),
    eligible: diag?.eligible ?? null,
    mp: merit && merit.missing.length === 0 ? merit.mp : (diag?.mp ? Number(diag.mp) : null),
    gridVersion: grid?.versao ?? null,
    regiao,
    availableRegions: regioesGrelha,
    regiaoSugerida,
    conditions,
    eligibilidade,
    selectedGridId: grid?.id ?? null,
    avisoConfirmado,
    avisos: await listAvisos(subject.program.code),
    grid: grid ? gridSummary(grid) : null,
    gridData,
    meritSelection,
    meritBreakdown: merit ?? null,
    meritProposal: lerPropostaMerito(
      diag?.meritProposal ?? null,
      diag?.meritProposalEstado ?? null,
      diag?.meritProposalNota ?? null,
    ),
    encerradoMotivo: diag?.encerradoMotivo ?? null,
    updatedAt: diag?.updatedAt.toISOString() ?? null,
  };
}

/**
 * Lógica partilhada (projeto/lead) das mutações do diagnóstico. Cada função
 * recebe o `owner` e devolve um resultado discriminado para o handler traduzir
 * em código HTTP. O `where`/`create` do Diagnostic usa SEMPRE `{ ...owner }`,
 * por isso projeto e lead diferem apenas pelo dono.
 */
type HandlerResult =
  | { ok: true; dto: DiagnosticDTO | null }
  | { ok: false; code: number; error: string };

const NOT_FOUND = (owner: DiagOwner): { ok: false; code: number; error: string } => ({
  ok: false,
  code: 404,
  error: "projectId" in owner ? "Projeto não encontrado." : "Lead não encontrada.",
});

/** TRNSF-1031 — ligar EXPLICITAMENTE o dono a um aviso (grelha) do programa. */
async function setAvisoHandler(owner: DiagOwner, meritGridIdRaw: unknown): Promise<HandlerResult> {
  const meritGridId = typeof meritGridIdRaw === "string" ? meritGridIdRaw : null;
  if (!meritGridId) return { ok: false, code: 400, error: "Indique o aviso a associar." };
  const subject = await resolveSubject(owner);
  if (!subject) return NOT_FOUND(owner);
  const grid = await prisma.meritGrid.findFirst({
    where: { id: meritGridId, programCode: subject.program.code },
  });
  if (!grid) return { ok: false, code: 400, error: "Aviso inválido para o programa deste projeto." };

  const current = await prisma.diagnostic.findUnique({ where: owner });
  const mudouAviso = current?.meritGridId !== grid.id;
  // Ao trocar de aviso, as condições de acesso passam a ser as do novo aviso.
  const conditions = mudouAviso
    ? ((grid.accessConditions as { key: string; label: string }[] | null) ?? []).map((c) => ({
        key: c.key, label: c.label, status: "NA" as const,
      }))
    : (current?.conditions ?? []);

  await prisma.diagnostic.upsert({
    where: owner,
    create: {
      ...owner,
      programId: subject.programId,
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
  return { ok: true, dto: await buildDTO(owner) };
}

/** TRNSF-1039 — sugerir a pontuação de mérito (IA propõe, consultor valida). */
async function sugerirMeritoHandler(owner: DiagOwner): Promise<HandlerResult> {
  const subject = await resolveSubject(owner);
  if (!subject) return NOT_FOUND(owner);

  const current = await prisma.diagnostic.findUnique({ where: owner });
  const grid = await resolveGrid(subject, current?.meritGridId ?? null);
  const gridData = (grid?.grid as MeritGridData | null) ?? null;
  if (!grid || !gridData) {
    return { ok: false, code: 409, error: "Sem grelha/aviso associado — escolha o aviso primeiro." };
  }

  // Região efetiva para a sugestão: a escolhida pelo consultor; na ausência, a
  // inferida a partir da localização validada da empresa (NUTS II → matriz da
  // grelha). FIXAÇÃO (bug do score instável): persistimos a grelha e a região no
  // diagnóstico, para que leituras e sugestões seguintes usem SEMPRE a mesma base.
  let regiao = current?.regiao ?? null;
  if (!regiao) {
    const dados = await dadosAcesso(owner);
    const geo = await resolverLocalizacao(dados.concelho ?? null, dados.freguesia ?? null);
    regiao = regiaoGrelhaParaNuts2(geo?.nuts2 ?? null, gridRegions(gridData)) ?? null;
  }
  const contexto = await contextoMerito(subject, owner);
  const { selection, justificacoes, nota } = await extrairMeritoDoProjeto(gridData, contexto, regiao);

  await prisma.diagnostic.upsert({
    where: owner,
    create: {
      ...owner,
      programId: subject.programId,
      meritGridId: grid.id,
      gridVersion: grid.versao,
      regiao,
      meritProposal: { selection, justificacoes, regiao } as object,
      meritProposalEstado: "por_validar",
      meritProposalNota: nota,
    },
    update: {
      // Pin da grelha + região (evita re-resolução heurística na leitura).
      meritGridId: grid.id,
      gridVersion: grid.versao,
      regiao,
      meritProposal: { selection, justificacoes, regiao } as object,
      meritProposalEstado: "por_validar",
      meritProposalNota: nota,
    },
  });
  return { ok: true, dto: await buildDTO(owner) };
}

/** G — guardar condições de acesso + selecções de mérito (recalcula e persiste). */
async function saveDiagnosticHandler(owner: DiagOwner, body: unknown): Promise<HandlerResult> {
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, code: 400, error: parsed.error.errors[0]?.message ?? "Dados inválidos." };
  }
  const subject = await resolveSubject(owner);
  if (!subject) return NOT_FOUND(owner);

  const current = await prisma.diagnostic.findUnique({ where: owner });
  const grid = await resolveGrid(subject, current?.meritGridId ?? null);

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

  await prisma.diagnostic.upsert({
    where: owner,
    create: {
      ...owner,
      programId: subject.programId,
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
  return { ok: true, dto: await buildDTO(owner) };
}

export async function diagnosticoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // G — abrir o diagnóstico de um projecto
  app.get<{ Params: { id: string } }>("/api/projects/:id/diagnostic", async (req, reply) => {
    const dto = await buildDTO({ projectId: req.params.id });
    if (!dto) return reply.code(404).send({ error: "Projeto não encontrado." });
    return dto;
  });

  // TRNSF-1031 — ligar EXPLICITAMENTE o projeto a um aviso (grelha) do programa.
  // É a escolha que dá a certeza de que o cliente está no aviso certo; sem ela
  // o diagnóstico não avança. Mudar de aviso repõe as condições de acesso.
  app.put<{ Params: { id: string }; Body: { meritGridId?: string } }>(
    "/api/projects/:id/diagnostic/aviso",
    async (req, reply) => {
      const r = await setAvisoHandler({ projectId: req.params.id }, req.body?.meritGridId);
      if (!r.ok) return reply.code(r.code).send({ error: r.error });
      return r.dto;
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
    const subject = await resolveSubject({ projectId: req.params.id });
    if (!subject) return reply.code(404).send({ error: "Projeto não encontrado." });
    const diag = await prisma.diagnostic.findUnique({ where: { projectId: req.params.id }, select: { meritGridId: true } });
    const grid = await resolveGrid(subject, diag?.meritGridId ?? null);
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
    return buildDTO({ projectId: req.params.id });
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
      const subject = await resolveSubject({ projectId: req.params.id });
      if (!subject) return reply.code(404).send({ error: "Projeto não encontrado." });
      const diag = await prisma.diagnostic.findUnique({ where: { projectId: req.params.id }, select: { meritGridId: true } });
      const grid = await resolveGrid(subject, diag?.meritGridId ?? null);
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
      return buildDTO({ projectId: req.params.id });
    },
  );

  // TRNSF-1039 — sugerir a pontuação de mérito (IA propõe, consultor valida).
  // Trabalho do consultor (só requireAuth, não admin) — espelha o save handler.
  // A IA PROPÕE uma opção/score + justificação por subcritério a partir dos
  // dados do projeto + da grelha; entra como `por_validar`. NÃO toca em
  // meritInputs (a selecção real do consultor) — a proposta é separada até o
  // consultor a aceitar e guardar. A pontuação final é sempre do consultor.
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/diagnostic/merito/sugerir",
    async (req, reply) => {
      const r = await sugerirMeritoHandler({ projectId: req.params.id });
      if (!r.ok) return reply.code(r.code).send({ error: r.error });
      return r.dto;
    },
  );

  // G — guardar condições de acesso + selecções de mérito (recalcula e persiste)
  app.put<{ Params: { id: string } }>("/api/projects/:id/diagnostic", async (req, reply) => {
    const r = await saveDiagnosticHandler({ projectId: req.params.id }, req.body);
    if (!r.ok) return reply.code(r.code).send({ error: r.error });
    return r.dto;
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

  // TRNSF-1044 — encerrar um diagnóstico A0 que NÃO passa, com justificação.
  // Estado terminal reversível "Não prosseguiu". Trabalho do consultor
  // (requireAuth, adicionado como preHandler do ficheiro). Só é possível quando
  // o mérito está abaixo do mínimo (A_REVER) ou uma condição de acesso falhou
  // (NAO_ELEGIVEL). Tudo fica registado em StateTransition + ActivityLog.
  app.post<{ Params: { id: string }; Body: { motivo?: string } }>(
    "/api/projects/:id/diagnostic/encerrar",
    async (req, reply) => {
      const parsed = encerrarSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.errors[0]?.message ?? "Indique o motivo do encerramento." });
      }
      const motivo = parsed.data.motivo;

      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      if (project.state !== "A0") {
        return reply.code(409).send({ error: "O projeto não está na fase A0." });
      }
      const diag = await prisma.diagnostic.findUnique({ where: { projectId: project.id } });
      const naoPassa = diag?.result === "A_REVER" || diag?.result === "NAO_ELEGIVEL";
      if (!naoPassa) {
        return reply.code(409).send({
          error:
            "Só é possível encerrar um diagnóstico que não passa (mérito abaixo do mínimo ou condição falhada).",
        });
      }

      await prisma.$transaction([
        prisma.project.update({ where: { id: project.id }, data: { state: "ENCERRADO" } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: "A0", toState: "ENCERRADO", byUserId: req.user!.id },
        }),
        prisma.diagnostic.update({
          where: { projectId: project.id },
          data: { encerradoMotivo: motivo, decidedByUserId: req.user!.id },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "state_transition",
            description: `Diagnóstico encerrado (não prosseguiu): ${motivo}`,
          },
        }),
      ]);
      return { ok: true, state: "ENCERRADO" };
    },
  );

  // TRNSF-1044 — reabrir um projeto encerrado, devolvendo-o a A0 (gestor/admin).
  // Limpa a justificação do encerramento e regista a transição inversa.
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/reopen",
    async (req, reply) => {
      // Papel de gestão OU permissão explícita "reabrir_projeto" (TRNSF-1056).
      if (!canManageUsers(req.user!.role) && !hasPermission(req.user!, "reabrir_projeto")) {
        return reply.code(403).send({ error: "Sem permissão para reabrir um projeto." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      if (project.state !== "ENCERRADO") {
        return reply.code(409).send({ error: "O projeto não está encerrado." });
      }

      await prisma.$transaction([
        prisma.project.update({ where: { id: project.id }, data: { state: "A0" } }),
        prisma.stateTransition.create({
          data: { projectId: project.id, fromState: "ENCERRADO", toState: "A0", byUserId: req.user!.id },
        }),
        prisma.diagnostic.updateMany({
          where: { projectId: project.id },
          data: { encerradoMotivo: null },
        }),
        prisma.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "state_transition",
            description: "Projeto reaberto para diagnóstico (A0).",
          },
        }),
      ]);
      return { ok: true, state: "A0" };
    },
  );

  // ── Rotas paralelas para a Lead (pré-projeto, Lead/Análise) ─────────────────
  // Mesmo motor/DTO/handlers; o dono é a lead em vez do projeto. O diagnóstico da
  // lead corre escolha de aviso + condições de acesso + mérito (não tem
  // advance/encerrar/reopen — qualificar/rejeitar vivem na própria lead).
  app.get<{ Params: { id: string } }>("/api/leads/:id/diagnostic", async (req, reply) => {
    const dto = await buildDTO({ leadId: req.params.id });
    if (!dto) return reply.code(404).send({ error: "Lead não encontrada." });
    return dto;
  });

  app.put<{ Params: { id: string }; Body: { meritGridId?: string } }>(
    "/api/leads/:id/diagnostic/aviso",
    async (req, reply) => {
      const r = await setAvisoHandler({ leadId: req.params.id }, req.body?.meritGridId);
      if (!r.ok) return reply.code(r.code).send({ error: r.error });
      return r.dto;
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/leads/:id/diagnostic/merito/sugerir",
    async (req, reply) => {
      const r = await sugerirMeritoHandler({ leadId: req.params.id });
      if (!r.ok) return reply.code(r.code).send({ error: r.error });
      return r.dto;
    },
  );

  app.put<{ Params: { id: string } }>("/api/leads/:id/diagnostic", async (req, reply) => {
    const r = await saveDiagnosticHandler({ leadId: req.params.id }, req.body);
    if (!r.ok) return reply.code(r.code).send({ error: r.error });
    return r.dto;
  });
}
