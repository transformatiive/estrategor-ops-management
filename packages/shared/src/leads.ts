/**
 * Lead / Análise (pré-projeto) — contrato partilhado.
 *
 * Uma Lead qualifica-se ANTES de existir um Project: tem cliente + programa,
 * corre-se o pré-diagnóstico na lead (mesmo motor) e ao "Qualificar" materializa-se
 * um Project que arranca na fase de Recolha (A1). O diagnóstico de mérito/
 * elegibilidade por projeto mantém-se inalterado (legado).
 */

/** Estado de qualificação da lead. */
export type LeadEstado = "analise" | "qualificada" | "rejeitada";

export const LEAD_ESTADO_LABEL: Record<LeadEstado, string> = {
  analise: "Em análise",
  qualificada: "Qualificada",
  rejeitada: "Rejeitada",
};

/** Item da lista de leads (secção Análise). */
export interface LeadListItemDTO {
  id: string;
  clientName: string;
  clientNif: string | null;
  programCode: string;
  programName: string;
  estado: LeadEstado;
  /** projeto materializado, quando qualificada */
  projectId: string | null;
  createdAt: string;
}

/** Detalhe de uma lead (página de análise). */
export interface LeadDTO {
  id: string;
  clientId: string;
  clientName: string;
  clientNif: string | null;
  programCode: string;
  programName: string;
  estado: LeadEstado;
  projectId: string | null;
  createdAt: string;
}

/** Criar uma lead: usa um cliente existente OU cria por nif/nome. */
export interface CreateLeadRequest {
  clientId?: string;
  nif?: string;
  clientName?: string;
  programCode: string;
}
