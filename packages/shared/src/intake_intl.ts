/**
 * Internacionalização — Intake diferenciado (TRNSF-962).
 *
 * Ramo Internacionalização do formulário ao cliente (TRNSF-937): recolhe o
 * plano de ações por evento/país, mercados-alvo, RH a contratar e certificações.
 * As respostas mapeiam para cand_intl_acoes (960), cand_intl_rh (961) e mercados
 * (942) com origem='intake'.
 */

export interface IntakeIntlAcao {
  designacao: string;
  /** número do domínio de internacionalização (1..6) */
  dominio: number;
  mercadoPais: string | null;
  ano: number | null;
}

export interface IntakeIntlRh {
  funcao: string;
  custo: number | null;
  periodo: string | null;
}

export interface IntakeIntlAnswers {
  acoes: IntakeIntlAcao[];
  mercadosAlvo: string[];
  rh: IntakeIntlRh[];
  certificacoes: string[];
  contexto: { estrategia: string | null };
}

export function emptyIntakeIntl(): IntakeIntlAnswers {
  return { acoes: [], mercadosAlvo: [], rh: [], certificacoes: [], contexto: { estrategia: null } };
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface IntakeIntlDTO {
  aplica: boolean;
  dominios: { numero: number; designacao: string }[];
  answers: IntakeIntlAnswers;
}
