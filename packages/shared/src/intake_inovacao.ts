/**
 * Inovação Produtiva — Intake diferenciado (TRNSF-959).
 *
 * O ramo Inovação do formulário ao cliente (TRNSF-937): recolhe o que não vem
 * dos documentos — intenções de investimento, tipologias pretendidas,
 * indicadores-meta e contexto. As respostas mapeiam para cand_investimentos
 * (945), cand_tipologias (955) e cand_indicadores (956) com origem='intake'.
 */

import type { TipologiaTipo } from "./tipologias.js";

export interface IntencaoInvestimento {
  designacao: string;
  /** código de categoria de custo (catálogo TRNSF-953) */
  categoria: string;
  montante: number | null;
  ano: number | null;
}

export interface IndicadoresMeta {
  emprego: number | null;
  volumeNegocios: number | null;
  capacidade: number | null;
}

export interface IntakeInovacaoAnswers {
  intencoes: IntencaoInvestimento[];
  tipologias: TipologiaTipo[];
  indicadoresMeta: IndicadoresMeta;
  contexto: { motivacao: string | null; mercadoAlvo: string | null };
}

export function emptyIntakeInovacao(): IntakeInovacaoAnswers {
  return {
    intencoes: [],
    tipologias: [],
    indicadoresMeta: { emprego: null, volumeNegocios: null, capacidade: null },
    contexto: { motivacao: null, mercadoAlvo: null },
  };
}

/** Mapeamento indicador-meta → código de indicador (catálogo TRNSF-953). */
export const META_INDICADOR_CODIGO: Record<keyof IndicadoresMeta, string> = {
  emprego: "RCR01",
  volumeNegocios: "RPR003",
  capacidade: "RPA001",
};

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface IntakeInovacaoDTO {
  /** o ramo Inovação aplica-se (projeto tem candidatura da família Inovação)? */
  aplica: boolean;
  categorias: { codigo: string; designacao: string }[];
  tipologias: { tipo: TipologiaTipo; label: string }[];
  answers: IntakeInovacaoAnswers;
}
