/**
 * Pré-diagnóstico assistido por IA (TRNSF-967) — contrato partilhado.
 *
 * Rascunho produzido em segundo plano na criação do cliente, com separação por
 * fiabilidade da fonte. Linha vermelha: a IA nunca decide elegibilidade; nada
 * tem efeito sem validação humana.
 */

import type { FieldOrigin, FieldState } from "./candidatura.js";

/** Estado de cada faixa (fonte) do pré-diagnóstico. */
export type FaixaEstado = "pendente" | "ok" | "falhou" | "sem_chave" | "indisponivel";

export const FAIXA_ESTADO_LABEL: Record<FaixaEstado, string> = {
  pendente: "Pendente",
  ok: "OK",
  falhou: "Falhou",
  sem_chave: "Sem chave",
  indisponivel: "N/A",
};

/** Campo pré-preenchido, com proveniência e fonte visíveis. */
export interface PreDiagCampo {
  key: string;
  label: string;
  value: string | number | null;
  /** oficial_vies | api_empresas | pre_diagnostico_ia */
  origem: FieldOrigin;
  /** validado (VIES) | por_validar (B/C) | corrigido */
  estado: FieldState;
  /** URL/identificador da fonte (auditoria) */
  fonte: string | null;
}

/** Item que a IA NÃO garante — só "a confirmar oficialmente" (nunca facto). */
export interface ChecklistAConfirmar {
  item: string;
  nota: string | null;
}

export interface PreDiagnosticoDTO {
  projectId: string;
  /** inexistente = não correu (ex.: cliente sem NIF) */
  estado: "pendente" | "concluido" | "falhou" | "inexistente";
  faixas: { vies: FaixaEstado; apiEmpresas: FaixaEstado; sonar: FaixaEstado; sonnet: FaixaEstado; elegibilidade: FaixaEstado };
  /** Razão curta de falha/resumo por faixa (diagnóstico/auditoria). */
  faixasDetalhe?: { vies?: string | null; apiEmpresas?: string | null; elegibilidade?: string | null };
  campos: PreDiagCampo[];
  checklistAConfirmar: ChecklistAConfirmar[];
  fontesSonar: string[];
  executadoEm: string | null;
}

/** Atualizar/validar um campo do pré-diagnóstico (campo a campo). */
export interface UpdatePreDiagCampoRequest {
  key: string;
  value?: string | number | null;
  action: "validar" | "corrigir";
}

export const FIELD_STATE_FROM_ORIGIN: Record<string, FieldState> = {
  oficial_vies: "validado",
  api_empresas: "por_validar",
  pre_diagnostico_ia: "por_validar",
};
