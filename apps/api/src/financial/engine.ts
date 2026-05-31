import {
  computeIndicadores,
  emptyMapas,
  gafPrePos,
  rubricasDe,
  validateCoherence,
  valorRubrica,
  type FinanceiroDTO,
  type FinanceiroMapas,
  type GafConciliacaoDTO,
  type MapaKey,
  type RubricaLinhaDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SECTION = "financeiro";
const MAPAS_KEY = "mapas";
const INDIC_KEY = "indicadores";

/** Mapeamento código de conta SNC → (mapa, rubrica canónica) para semear a
 *  componente financeira a partir da extração (TRNSF-952). Classes SNC. */
const SNC_TO_RUBRICA: Record<string, { mapa: MapaKey; rubrica: string }> = {
  "431": { mapa: "balanco", rubrica: "ativo_nao_corrente" },
  "433": { mapa: "balanco", rubrica: "ativo_nao_corrente" },
  "434": { mapa: "balanco", rubrica: "ativo_nao_corrente" },
  "435": { mapa: "balanco", rubrica: "ativo_nao_corrente" },
  "441": { mapa: "balanco", rubrica: "ativo_nao_corrente" },
  "11": { mapa: "balanco", rubrica: "ativo_corrente" },
  "12": { mapa: "balanco", rubrica: "ativo_corrente" },
  "21": { mapa: "balanco", rubrica: "ativo_corrente" },
  "22": { mapa: "balanco", rubrica: "passivo_corrente" },
  "25": { mapa: "balanco", rubrica: "passivo_nao_corrente" },
  "71": { mapa: "dr", rubrica: "vendas_servicos" },
  "72": { mapa: "dr", rubrica: "vendas_servicos" },
  "61": { mapa: "dr", rubrica: "cmvmc" },
  "63": { mapa: "dr", rubrica: "gastos_pessoal" },
  "64": { mapa: "dr", rubrica: "depreciacoes_amortizacoes" },
};

function readMapas(value: unknown): FinanceiroMapas {
  if (value && typeof value === "object" && "anos" in (value as object)) {
    const v = value as FinanceiroMapas;
    return { anos: v.anos ?? [], balanco: v.balanco ?? {}, dr: v.dr ?? {}, financiamento: v.financiamento ?? {} };
  }
  return emptyMapas();
}

async function loadMapasField(candidaturaId: string) {
  return prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: MAPAS_KEY } },
  });
}

/** Soma um valor na célula (rubrica, ano), criando os níveis em falta. */
function addCell(mapas: FinanceiroMapas, mapa: MapaKey, rubrica: string, ano: string, valor: number) {
  const m = mapas[mapa];
  m[rubrica] = m[rubrica] ?? {};
  m[rubrica]![ano] = (m[rubrica]![ano] ?? 0) + valor;
}

/**
 * Semeia a componente financeira a partir da tabela SNC extraída
 * (financeiro/demonstracoes_financeiras, TRNSF-952): agrega os códigos de conta
 * nas rubricas canónicas. Grava em financeiro/mapas com origem='extraido'.
 */
export async function seedFromExtraction(candidaturaId: string, userId: string): Promise<boolean> {
  const df = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: "demonstracoes_financeiras" } },
  });
  const val = df?.value as { anos?: number[]; linhas?: { codigo: string; valores: Record<string, number> }[] } | undefined;
  if (!val || !Array.isArray(val.linhas) || val.linhas.length === 0) return false;

  const anos = (val.anos ?? []).slice();
  const mapas = emptyMapas(anos);
  for (const linha of val.linhas) {
    const target = SNC_TO_RUBRICA[linha.codigo];
    if (!target) continue;
    for (const [ano, valor] of Object.entries(linha.valores ?? {})) {
      if (!anos.includes(Number(ano)) && /^\d{4}$/.test(ano)) anos.push(Number(ano));
      addCell(mapas, target.mapa, target.rubrica, ano, Number(valor) || 0);
    }
  }
  mapas.anos = anos.sort((a, b) => a - b);

  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: MAPAS_KEY } },
    update: { value: mapas as object, origin: "extraido", state: "por_validar", sourceRef: "extracao:demonstracoes_financeiras", updatedById: userId },
    create: {
      candidaturaId,
      section: SECTION,
      key: MAPAS_KEY,
      value: mapas as object,
      origin: "extraido",
      state: "por_validar",
      sourceRef: "extracao:demonstracoes_financeiras",
      updatedById: userId,
    },
  });
  return true;
}

/** Atualiza/corrige uma célula de input e regrava (estado corrigido). */
export async function updateCell(
  candidaturaId: string,
  mapa: MapaKey,
  rubrica: string,
  ano: number,
  valor: number,
  userId: string,
): Promise<void> {
  const def = rubricasDe(mapa).find((r) => r.key === rubrica);
  if (!def) throw new Error("RUBRICA_UNKNOWN");
  if (def.kind === "computed") throw new Error("RUBRICA_COMPUTED"); // calculadas não se editam

  const field = await loadMapasField(candidaturaId);
  const mapas = readMapas(field?.value);
  if (!mapas.anos.includes(ano)) mapas.anos = [...mapas.anos, ano].sort((a, b) => a - b);
  mapas[mapa][rubrica] = mapas[mapa][rubrica] ?? {};
  mapas[mapa][rubrica]![String(ano)] = valor;

  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: MAPAS_KEY } },
    update: { value: mapas as object, state: "corrigido", updatedById: userId },
    create: {
      candidaturaId,
      section: SECTION,
      key: MAPAS_KEY,
      value: mapas as object,
      origin: "intake",
      state: "corrigido",
      updatedById: userId,
    },
  });
  await persistIndicadores(candidaturaId, mapas, userId);
}

/** Marca os inputs históricos como validados (gating dos cálculos finais). */
export async function validateInputs(candidaturaId: string, userId: string): Promise<void> {
  const field = await loadMapasField(candidaturaId);
  if (!field) throw new Error("SEM_DADOS");
  await prisma.candField.update({ where: { id: field.id }, data: { state: "validado", updatedById: userId } });
  await persistIndicadores(candidaturaId, readMapas(field.value), userId);
}

/** Persiste os indicadores calculados (origem='calculado') para o mérito (946). */
async function persistIndicadores(candidaturaId: string, mapas: FinanceiroMapas, userId: string): Promise<void> {
  const indicadores = computeIndicadores(mapas);
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: INDIC_KEY } },
    update: { value: indicadores as object, origin: "calculado", state: "validado", updatedById: userId },
    create: {
      candidaturaId,
      section: SECTION,
      key: INDIC_KEY,
      value: indicadores as object,
      origin: "calculado",
      state: "validado",
      updatedById: userId,
    },
  });
}

/** Lê o valor de autonomia financeira do Diagnóstico A0, se existir. */
function autonomiaDoDiagnostico(diag: { meritInputs: unknown; conditions: unknown } | null): number | null {
  if (!diag) return null;
  const mi = diag.meritInputs as Record<string, unknown> | null;
  for (const k of ["autonomia_financeira", "autonomiaFinanceira", "gaf"]) {
    const v = mi?.[k];
    if (typeof v === "number") return v;
  }
  // procura nas condições de acesso por uma com "autonomia" e nota numérica
  const conds = Array.isArray(diag.conditions) ? (diag.conditions as { label?: string; key?: string; note?: string }[]) : [];
  for (const c of conds) {
    if (/autonomia/i.test(`${c.label ?? ""} ${c.key ?? ""}`)) {
      const n = Number(String(c.note ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function rubricaLinhas(mapas: FinanceiroMapas, mapa: MapaKey): RubricaLinhaDTO[] {
  return rubricasDe(mapa).map((def) => ({
    key: def.key,
    label: def.label,
    kind: def.kind,
    valores: Object.fromEntries(mapas.anos.map((a) => [String(a), valorRubrica(mapas, mapa, def.key, a)])),
  }));
}

/** Estado da componente financeira: tabelas, indicadores, coerência, GAF×A0. */
export async function buildFinanceiroDTO(projectId: string): Promise<FinanceiroDTO | null> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return null;

  const field = await loadMapasField(cand.id);
  const mapas = readMapas(field?.value);
  const inputsValidados = field ? field.state === "validado" || field.state === "corrigido" : false;

  const { pre: gafCalculado } = gafPrePos(mapas);
  const diag = await prisma.diagnostic.findUnique({
    where: { projectId },
    select: { meritInputs: true, conditions: true },
  });
  const gafDiagnostico = autonomiaDoDiagnostico(diag);
  let concilia: boolean | null = null;
  let nota = "Sem valor de autonomia financeira no A0 para conciliar.";
  if (gafCalculado != null && gafDiagnostico != null) {
    concilia = Math.abs(gafCalculado - gafDiagnostico) <= 0.01;
    nota = concilia
      ? "GAF concilia com a condição de autonomia financeira do A0."
      : `GAF calculado (${gafCalculado}) diverge do A0 (${gafDiagnostico}).`;
  } else if (gafCalculado != null) {
    nota = `GAF pré-projeto calculado: ${gafCalculado}.`;
  }
  const gaf: GafConciliacaoDTO = { gafCalculado, gafDiagnostico, concilia, nota };

  const coherence = validateCoherence(mapas);
  if (concilia === false) {
    coherence.push({ mapa: "geral", ano: null, mensagem: nota });
  }

  return {
    anos: mapas.anos,
    balanco: rubricaLinhas(mapas, "balanco"),
    dr: rubricaLinhas(mapas, "dr"),
    financiamento: rubricaLinhas(mapas, "financiamento"),
    indicadores: computeIndicadores(mapas),
    coherence,
    gaf,
    inputsValidados,
  };
}
