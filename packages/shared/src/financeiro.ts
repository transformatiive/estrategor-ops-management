/**
 * Componente Financeira da candidatura (TRNSF-944) — DADOS estruturados +
 * cálculo DETERMINÍSTICO (nunca IA faz a aritmética).
 *
 * O modelo é rubrica × ano para três mapas (balanço, demonstração de
 * resultados, financiamento). Os históricos chegam por extração (TRNSF-952) e
 * são validados pelo humano; totais, rácios e indicadores são CALCULADOS em
 * código (origem='calculado'). As incoerências (totais que não fecham, GAF
 * divergente do A0) são assinaladas, nunca silenciadas.
 */

/** Tipo de rubrica: introduzida (input) ou calculada por fórmula. */
export type RubricaKind = "input" | "computed";

export interface RubricaDef {
  key: string;
  label: string;
  kind: RubricaKind;
}

// ─── Balanço (rubricas SNC agregadas) ────────────────────────────────────────
export const BALANCO_RUBRICAS: RubricaDef[] = [
  { key: "ativo_nao_corrente", label: "Ativo não corrente", kind: "input" },
  { key: "ativo_corrente", label: "Ativo corrente", kind: "input" },
  { key: "total_ativo", label: "Total do Ativo", kind: "computed" },
  { key: "capital_realizado", label: "Capital realizado", kind: "input" },
  { key: "reservas", label: "Reservas", kind: "input" },
  { key: "resultados_transitados", label: "Resultados transitados", kind: "input" },
  { key: "resultado_liquido", label: "Resultado líquido do período", kind: "input" },
  { key: "outros_capital_proprio", label: "Outros instrumentos de capital próprio", kind: "input" },
  { key: "total_capital_proprio", label: "Total do Capital Próprio", kind: "computed" },
  { key: "passivo_nao_corrente", label: "Passivo não corrente", kind: "input" },
  { key: "passivo_corrente", label: "Passivo corrente", kind: "input" },
  { key: "total_passivo", label: "Total do Passivo", kind: "computed" },
  { key: "autonomia_financeira", label: "Autonomia financeira (CP / Ativo)", kind: "computed" },
];

// ─── Demonstração de Resultados ──────────────────────────────────────────────
export const DR_RUBRICAS: RubricaDef[] = [
  { key: "vendas_servicos", label: "Vendas e serviços prestados", kind: "input" },
  { key: "subsidios_exploracao", label: "Subsídios à exploração", kind: "input" },
  { key: "cmvmc", label: "CMVMC", kind: "input" },
  { key: "fse", label: "Fornecimentos e serviços externos", kind: "input" },
  { key: "gastos_pessoal", label: "Gastos com o pessoal", kind: "input" },
  { key: "imparidades", label: "Imparidades e provisões", kind: "input" },
  { key: "ebitda", label: "Resultado antes de depreciações, juros e impostos (EBITDA)", kind: "computed" },
  { key: "depreciacoes_amortizacoes", label: "Depreciações e amortizações", kind: "input" },
  { key: "resultado_operacional", label: "Resultado operacional (EBIT)", kind: "computed" },
  { key: "juros", label: "Juros e gastos similares", kind: "input" },
  { key: "rai", label: "Resultado antes de impostos", kind: "computed" },
  { key: "imposto", label: "Imposto sobre o rendimento", kind: "input" },
  { key: "resultado_liquido", label: "Resultado líquido do período", kind: "computed" },
];

// ─── Financiamento ───────────────────────────────────────────────────────────
export const FINANCIAMENTO_RUBRICAS: RubricaDef[] = [
  { key: "capital", label: "Capital", kind: "input" },
  { key: "prestacoes_suplementares", label: "Prestações suplementares", kind: "input" },
  { key: "premios_emissao", label: "Prémios de emissão", kind: "input" },
  { key: "capitais_proprios", label: "Capitais próprios", kind: "computed" },
  { key: "autofinanciamento", label: "Autofinanciamento", kind: "input" },
  { key: "fin_credito", label: "Instituições de crédito", kind: "input" },
  { key: "fin_socios", label: "Sócios / suprimentos", kind: "input" },
  { key: "fin_locacao", label: "Locação financeira", kind: "input" },
  { key: "fin_fornecedores_invest", label: "Fornecedores de investimento", kind: "input" },
  { key: "financiamentos", label: "Financiamentos", kind: "computed" },
  { key: "inr", label: "Apoio não reembolsável (INR)", kind: "input" },
  { key: "financiamento_total", label: "Financiamento total", kind: "computed" },
  { key: "custo_total", label: "Custo total do investimento", kind: "input" },
];

export type MapaKey = "balanco" | "dr" | "financiamento";

export function rubricasDe(mapa: MapaKey): RubricaDef[] {
  return mapa === "balanco" ? BALANCO_RUBRICAS : mapa === "dr" ? DR_RUBRICAS : FINANCIAMENTO_RUBRICAS;
}

/** Dados de entrada: rubrica → ano → valor. Só as rubricas `input` são gravadas. */
export type MapaValores = Record<string, Record<string, number>>;

export interface FinanceiroMapas {
  anos: number[];
  balanco: MapaValores;
  dr: MapaValores;
  financiamento: MapaValores;
}

export function emptyMapas(anos: number[] = []): FinanceiroMapas {
  return { anos, balanco: {}, dr: {}, financiamento: {} };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function cell(m: MapaValores, rubrica: string, ano: number): number {
  return m[rubrica]?.[String(ano)] ?? 0;
}

// ─── Cálculo determinístico das rubricas computed, por ano ────────────────────

export function computeBalancoAno(m: MapaValores, ano: number): Record<string, number> {
  const g = (k: string) => cell(m, k, ano);
  const totalAtivo = g("ativo_nao_corrente") + g("ativo_corrente");
  const totalCapitalProprio =
    g("capital_realizado") + g("reservas") + g("resultados_transitados") + g("resultado_liquido") + g("outros_capital_proprio");
  const totalPassivo = g("passivo_nao_corrente") + g("passivo_corrente");
  const autonomia = totalAtivo !== 0 ? round2(totalCapitalProprio / totalAtivo) : 0;
  return {
    total_ativo: round2(totalAtivo),
    total_capital_proprio: round2(totalCapitalProprio),
    total_passivo: round2(totalPassivo),
    autonomia_financeira: autonomia,
  };
}

export function computeDrAno(m: MapaValores, ano: number): Record<string, number> {
  const g = (k: string) => cell(m, k, ano);
  const ebitda = g("vendas_servicos") + g("subsidios_exploracao") - g("cmvmc") - g("fse") - g("gastos_pessoal") - g("imparidades");
  const resultadoOperacional = ebitda - g("depreciacoes_amortizacoes");
  const rai = resultadoOperacional - g("juros");
  const resultadoLiquido = rai - g("imposto");
  return {
    ebitda: round2(ebitda),
    resultado_operacional: round2(resultadoOperacional),
    rai: round2(rai),
    resultado_liquido: round2(resultadoLiquido),
  };
}

export function computeFinanciamentoAno(m: MapaValores, ano: number): Record<string, number> {
  const g = (k: string) => cell(m, k, ano);
  const capitaisProprios = g("capital") + g("prestacoes_suplementares") + g("premios_emissao");
  const financiamentos = g("fin_credito") + g("fin_socios") + g("fin_locacao") + g("fin_fornecedores_invest");
  const financiamentoTotal = capitaisProprios + g("autofinanciamento") + financiamentos + g("inr");
  return {
    capitais_proprios: round2(capitaisProprios),
    financiamentos: round2(financiamentos),
    financiamento_total: round2(financiamentoTotal),
  };
}

/** Valor de uma rubrica (input ou computed) num ano. */
export function valorRubrica(mapas: FinanceiroMapas, mapa: MapaKey, rubrica: string, ano: number): number {
  const def = rubricasDe(mapa).find((r) => r.key === rubrica);
  if (def?.kind === "computed") {
    const computed =
      mapa === "balanco" ? computeBalancoAno(mapas.balanco, ano)
      : mapa === "dr" ? computeDrAno(mapas.dr, ano)
      : computeFinanciamentoAno(mapas.financiamento, ano);
    return computed[rubrica] ?? 0;
  }
  const m = mapa === "balanco" ? mapas.balanco : mapa === "dr" ? mapas.dr : mapas.financiamento;
  return cell(m, rubrica, ano);
}

// ─── Indicadores determinísticos ─────────────────────────────────────────────
// Identidades contabilísticas padrão; não são regras de mérito inventadas. As
// fórmulas exatas do MP fecham no Verificador/grelha (TRNSF-946/941).

export interface IndicadorLinha {
  key: string;
  label: string;
  unidade: string;
  valores: Record<string, number | null>;
}

export function computeIndicadores(mapas: FinanceiroMapas): IndicadorLinha[] {
  const anos = mapas.anos;
  const perAno = <T>(fn: (ano: number) => T): Record<string, T> =>
    Object.fromEntries(anos.map((a) => [String(a), fn(a)]));

  const gB = (k: string, a: number) => valorRubrica(mapas, "balanco", k, a);
  const gD = (k: string, a: number) => valorRubrica(mapas, "dr", k, a);

  return [
    {
      key: "meios_libertos_liquidos",
      label: "Meios libertos líquidos",
      unidade: "€",
      // RL + Depreciações/Amortizações + Imparidades/Provisões
      valores: perAno((a) => round2(gD("resultado_liquido", a) + gD("depreciacoes_amortizacoes", a) + gD("imparidades", a))),
    },
    {
      key: "gaf",
      label: "Grau de autonomia financeira (CP / Ativo)",
      unidade: "rácio",
      valores: perAno((a) => gB("autonomia_financeira", a)),
    },
    {
      key: "vab",
      label: "Valor acrescentado bruto (VAB)",
      unidade: "€",
      // VAB = produção − consumos intermédios = (vendas + subsídios) − CMVMC − FSE
      valores: perAno((a) => round2(gD("vendas_servicos", a) + gD("subsidios_exploracao", a) - gD("cmvmc", a) - gD("fse", a))),
    },
    {
      key: "vbp",
      label: "Valor bruto de produção (VBP)",
      unidade: "€",
      // proxy: vendas e serviços + subsídios à exploração (sem variação de produção)
      valores: perAno((a) => round2(gD("vendas_servicos", a) + gD("subsidios_exploracao", a))),
    },
    {
      key: "vn",
      label: "Volume de negócios",
      unidade: "€",
      valores: perAno((a) => round2(gD("vendas_servicos", a))),
    },
  ];
}

/** GAF pré (primeiro ano) e pós (último ano) do projeto. */
export function gafPrePos(mapas: FinanceiroMapas): { pre: number | null; pos: number | null; anoPre: number | null; anoPos: number | null } {
  if (mapas.anos.length === 0) return { pre: null, pos: null, anoPre: null, anoPos: null };
  const anoPre = mapas.anos[0]!;
  const anoPos = mapas.anos[mapas.anos.length - 1]!;
  return {
    pre: valorRubrica(mapas, "balanco", "autonomia_financeira", anoPre),
    pos: valorRubrica(mapas, "balanco", "autonomia_financeira", anoPos),
    anoPre,
    anoPos,
  };
}

// ─── Validações de coerência ──────────────────────────────────────────────────

export interface CoerenciaIssue {
  mapa: MapaKey | "geral";
  ano: number | null;
  mensagem: string;
}

const TOL = 1; // tolerância de arredondamento (€)

export function validateCoherence(mapas: FinanceiroMapas): CoerenciaIssue[] {
  const issues: CoerenciaIssue[] = [];
  for (const ano of mapas.anos) {
    const b = computeBalancoAno(mapas.balanco, ano);
    // Ativo = Capital Próprio + Passivo
    if (Math.abs(b.total_ativo! - (b.total_capital_proprio! + b.total_passivo!)) > TOL) {
      issues.push({
        mapa: "balanco",
        ano,
        mensagem: `Balanço não fecha em ${ano}: Ativo (${b.total_ativo}) ≠ Capital Próprio + Passivo (${round2(b.total_capital_proprio! + b.total_passivo!)}).`,
      });
    }
    // Financiamento total = Custo total do investimento
    const f = computeFinanciamentoAno(mapas.financiamento, ano);
    const custo = cell(mapas.financiamento, "custo_total", ano);
    if (custo !== 0 && Math.abs(f.financiamento_total! - custo) > TOL) {
      issues.push({
        mapa: "financiamento",
        ano,
        mensagem: `Financiamento de ${ano} não cobre o custo: total (${f.financiamento_total}) ≠ custo do investimento (${custo}).`,
      });
    }
  }
  return issues;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface RubricaLinhaDTO {
  key: string;
  label: string;
  kind: RubricaKind;
  valores: Record<string, number>;
}

export interface GafConciliacaoDTO {
  /** GAF pré-projeto calculado na componente financeira */
  gafCalculado: number | null;
  /** valor da autonomia financeira registado no Diagnóstico A0, se existir */
  gafDiagnostico: number | null;
  /** concilia dentro da tolerância? null se não há valor no A0 para comparar */
  concilia: boolean | null;
  nota: string;
}

export interface FinanceiroDTO {
  anos: number[];
  balanco: RubricaLinhaDTO[];
  dr: RubricaLinhaDTO[];
  financiamento: RubricaLinhaDTO[];
  indicadores: IndicadorLinha[];
  coherence: CoerenciaIssue[];
  gaf: GafConciliacaoDTO;
  /** os inputs históricos já foram validados pelo humano? (gating dos cálculos finais) */
  inputsValidados: boolean;
}

export interface UpdateFinanceiroCellRequest {
  mapa: MapaKey;
  rubrica: string;
  ano: number;
  valor: number;
}
