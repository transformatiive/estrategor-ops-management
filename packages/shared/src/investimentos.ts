/**
 * Custos / Investimentos + Resumo Executivo (TRNSF-945).
 *
 * `cand_investimentos`: uma linha por investimento (origem='intake'). As
 * categorias de custo vêm do catálogo (TRNSF-953, por família). Os totais são
 * calculados em código e têm de COINCIDIR com a componente financeira
 * (TRNSF-944) — divergências assinaladas. O Resumo Executivo é uma compilação
 * (números calculados + texto gerado).
 */

/** Linha de investimento. `categoria` é o código de uma categoria do catálogo. */
export interface InvestimentoLinha {
  id: string;
  designacao: string;
  /** código da categoria de custo (catálogo TRNSF-953) */
  categoria: string;
  /** atividade de inovação (Família A) ou ação (Família B) associada */
  atividade?: string | null;
  estabelecimento?: string | null;
  /** data de aquisição prevista (aaaa-mm) */
  dataAquisicao?: string | null;
  /** montante elegível (€) */
  elegivel: number;
  /** flag efeito incentivo (EF) */
  ef: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ano (aaaa) a partir de uma data aaaa-mm; null se inválida. */
export function anoDe(data?: string | null): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(data ?? "");
  return m ? Number(m[1]) : null;
}

export function totalElegivel(linhas: InvestimentoLinha[]): number {
  return round2(linhas.reduce((s, l) => s + (Number(l.elegivel) || 0), 0));
}

export function totaisPorCategoria(linhas: InvestimentoLinha[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) out[l.categoria] = round2((out[l.categoria] ?? 0) + (Number(l.elegivel) || 0));
  return out;
}

export function totaisPorAno(linhas: InvestimentoLinha[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) {
    const ano = anoDe(l.dataAquisicao);
    const k = ano != null ? String(ano) : "sem_data";
    out[k] = round2((out[k] ?? 0) + (Number(l.elegivel) || 0));
  }
  return out;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface CategoriaCustoDTO {
  codigo: string;
  designacao: string;
}

export interface CoerenciaInvestimentoDTO {
  /** total elegível das linhas de investimento */
  totalElegivel: number;
  /** custo total do investimento na componente financeira (TRNSF-944) */
  custoFinanceira: number | null;
  /** diferença (investimentos − financeira); 0 = coincide */
  divergencia: number | null;
  /** coincide dentro da tolerância? null se a financeira não tem custo definido */
  coincide: boolean | null;
  /** divergências de faseamento por ano (ano → diferença) */
  faseamentoPorAno: { ano: string; investimentos: number; financeira: number; diff: number }[];
}

export interface InvestimentosDTO {
  linhas: InvestimentoLinha[];
  categorias: CategoriaCustoDTO[];
  totaisPorCategoria: Record<string, number>;
  totaisPorAno: Record<string, number>;
  totalElegivel: number;
  coerencia: CoerenciaInvestimentoDTO;
}

export interface NovaInvestimentoLinha {
  designacao: string;
  categoria: string;
  atividade?: string | null;
  estabelecimento?: string | null;
  dataAquisicao?: string | null;
  elegivel: number;
  ef?: boolean;
}

/** Pré-visualização da importação do mapa de investimentos (TRNSF-1070). */
export interface MapaInvestimentosPreviewDTO {
  linhas: NovaInvestimentoLinha[];
  nota: string | null;
}

export interface ResumoExecutivoIndicador {
  key: string;
  label: string;
  unidade: string;
  valor: number | null;
}

export interface ResumoExecutivoDTO {
  /** texto do objeto da operação (gerado, TRNSF-943) se já existir */
  objeto: string | null;
  investimentoTotalElegivel: number;
  incentivoPrevisto: number | null;
  indicadores: ResumoExecutivoIndicador[];
  /** avisos: o que falta para o resumo ficar completo */
  pendentes: string[];
}
