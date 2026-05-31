/**
 * Inovação Produtiva — Indústria 4.0 (A.16) + Transição Climática (A.17),
 * TRNSF-957. Ambas condicionais. Os textos são gerados pelo motor de geração
 * (TRNSF-943: industria_40_* 1000 car. e transicao_climatica_fundamentacao); este
 * módulo guarda a estrutura (que âmbitos se aplicam) e a ligação aos indicadores
 * RPA — que, quando presentes, exigem a fundamentação correspondente (verificada
 * por TRNSF-946).
 */

export const INDUSTRIA40_AMBITOS = ["produto", "processo", "organizacional", "marketing"] as const;
export type Industria40Ambito = (typeof INDUSTRIA40_AMBITOS)[number];

export const INDUSTRIA40_LABELS: Record<Industria40Ambito, string> = {
  produto: "Inovação de produto",
  processo: "Inovação de processo",
  organizacional: "Inovação organizacional",
  marketing: "Inovação de marketing",
};

/** doc_type de geração (TRNSF-943) por âmbito de Indústria 4.0. */
export const INDUSTRIA40_DOCTYPE: Record<Industria40Ambito, string> = {
  produto: "industria_40_inovacao_produto",
  processo: "industria_40_inovacao_processo",
  organizacional: "industria_40_inovacao_organizacional",
  marketing: "industria_40_inovacao_marketing",
};

/** Prefixo dos códigos de indicador RPA (transição climática). */
export const RPA_PREFIX = "RPA";

export function temIndicadoresRpa(codigos: string[]): boolean {
  return codigos.some((c) => c.toUpperCase().startsWith(RPA_PREFIX));
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface Industria40DTO {
  /** âmbito → aplicável */
  ambitos: Record<Industria40Ambito, boolean>;
}

export interface TransicaoClimaticaDTO {
  /** âmbitos invocados (texto livre; do aviso) */
  ambitos: string[];
  /** há indicadores RPA na candidatura → fundamentação RPA obrigatória */
  temIndicadoresRpa: boolean;
}

export interface InovacaoExtraDTO {
  industria40: Industria40DTO;
  transicaoClimatica: TransicaoClimaticaDTO;
}

export interface UpdateInovacaoExtraRequest {
  industria40Ambitos?: Partial<Record<Industria40Ambito, boolean>>;
  transicaoAmbitos?: string[];
}
