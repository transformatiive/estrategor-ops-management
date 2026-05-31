/**
 * Inovação Produtiva — Atividades de inovação + Indicadores (TRNSF-956,
 * secções A.11/A.12). As atividades têm caracterização gerada (TRNSF-943,
 * atividade_caracterizacao). Os indicadores usam os códigos oficiais do catálogo
 * (TRNSF-953); os calculáveis vêm da componente financeira (TRNSF-944) e os
 * restantes por intake. Alimentam o cálculo do MP (TRNSF-946).
 */

export interface AtividadeLinha {
  id: string;
  designacao: string;
}

export type IndicadorFonte = "calculado" | "intake";

export interface CandIndicadorLinha {
  id: string;
  /** código do catálogo (CatalogoIndicador) */
  codigo: string;
  valorPre: number | null;
  valorMeta: number | null;
  unidade: string | null;
  fonte: IndicadorFonte;
}

/** Mapeamento indicador (código) → indicador calculado da financeira (TRNSF-944). */
export const INDICADOR_FONTE_FINANCEIRA: Record<string, string> = {
  RPR003: "vn", // Volume de negócios
  RPR002: "vab", // VAB
};

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface CatalogoIndicadorDTO {
  codigo: string;
  designacao: string;
  unidade: string | null;
}

export interface AtividadesIndicadoresDTO {
  atividades: AtividadeLinha[];
  indicadores: CandIndicadorLinha[];
  catalogo: CatalogoIndicadorDTO[];
}

export interface NovaAtividade {
  designacao: string;
}

export interface NovoIndicador {
  codigo: string;
  valorPre?: number | null;
  valorMeta?: number | null;
}
