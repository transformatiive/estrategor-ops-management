/**
 * Internacionalização — Detalhe da ação (custos + deslocações) + RH a contratar
 * (TRNSF-961, secções B.10/B.11). As rubricas de custo vêm do catálogo
 * (TRNSF-953, categorias da família internacionalização). Os custos têm de
 * coincidir com a componente financeira (944) e os custos globais (945).
 */

export interface IntlAcaoCusto {
  id: string;
  acaoId: string;
  /** código de rubrica de custo (catálogo TRNSF-953, família intl) */
  rubrica: string;
  montante: number | null;
  ano: number | null;
}

export interface IntlDeslocacao {
  id: string;
  acaoId: string;
  pessoa: string;
  destino: string | null;
  dias: number | null;
  viagem: number | null;
  estadia: number | null;
  ajudasCusto: number | null;
}

export interface IntlRh {
  id: string;
  funcao: string;
  custo: number | null;
  periodo: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalCustos(custos: IntlAcaoCusto[]): number {
  return round2(custos.reduce((s, c) => s + (Number(c.montante) || 0), 0));
}

export function totalDeslocacoes(desl: IntlDeslocacao[]): number {
  return round2(desl.reduce((s, d) => s + (Number(d.viagem) || 0) + (Number(d.estadia) || 0) + (Number(d.ajudasCusto) || 0), 0));
}

export function totalRh(rh: IntlRh[]): number {
  return round2(rh.reduce((s, r) => s + (Number(r.custo) || 0), 0));
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface IntlDetalheDTO {
  acoes: { id: string; label: string }[];
  rubricas: { codigo: string; designacao: string }[];
  custos: IntlAcaoCusto[];
  deslocacoes: IntlDeslocacao[];
  rh: IntlRh[];
  /** totais e coerência com a componente financeira (944) */
  totalCustos: number;
  totalDeslocacoes: number;
  totalRh: number;
  totalGlobal: number;
  custoFinanceira: number | null;
  coincide: boolean | null;
}

export interface NovoIntlCusto {
  acaoId: string;
  rubrica: string;
  montante?: number | null;
  ano?: number | null;
}

export interface NovaIntlDeslocacao {
  acaoId: string;
  pessoa: string;
  destino?: string | null;
  dias?: number | null;
  viagem?: number | null;
  estadia?: number | null;
  ajudasCusto?: number | null;
}

export interface NovoIntlRh {
  funcao: string;
  custo?: number | null;
  periodo?: string | null;
}
