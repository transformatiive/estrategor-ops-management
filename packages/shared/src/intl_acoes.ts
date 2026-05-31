/**
 * Internacionalização — Ações de intervenção + Indicadores (TRNSF-960,
 * secções B.8/B.9). 6 domínios fixos (catálogo TRNSF-953) e a tabela densa de
 * ações (domínio, tipo, mercado, ano). Cada ação liga ao seu detalhe (TRNSF-961)
 * e os indicadores alimentam o cálculo do MP (TRNSF-946).
 */

export interface IntlDominioEstado {
  numero: number;
  aplicavel: boolean;
  contributo: string | null;
}

export interface IntlAcao {
  id: string;
  /** número do domínio de internacionalização (1..6, catálogo) */
  dominio: number;
  tipoAcao: string;
  mercadoPais: string | null;
  ano: number | null;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface IntlAcoesDTO {
  /** os 6 domínios do catálogo, com aplicabilidade e contributo */
  dominios: { numero: number; designacao: string; aplicavel: boolean; contributo: string | null }[];
  acoes: IntlAcao[];
}

export interface NovaIntlAcao {
  dominio: number;
  tipoAcao: string;
  mercadoPais?: string | null;
  ano?: number | null;
}

export interface UpdateIntlDominio {
  numero: number;
  aplicavel?: boolean;
  contributo?: string | null;
}
