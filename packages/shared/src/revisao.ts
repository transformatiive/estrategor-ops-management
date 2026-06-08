/**
 * Revisão interna (A3) — TRNSF-947.
 *
 * Formaliza o controlo de qualidade interno na fase A3: um gestor (com a
 * permissão `aprovar_revisao_interna`) revê a candidatura completa com uma
 * checklist de aprovação e ou APROVA (→ A4) ou DEVOLVE ao consultor com
 * comentários (→ A2). Cada decisão fica registada (revisor, data, resultado,
 * comentários e um snapshot da checklist).
 */

export type RevisaoItemStatus = "ok" | "falha" | "indeterminado";

/** Um item da checklist de revisão, calculado no momento da decisão. */
export interface RevisaoChecklistItemDTO {
  key: string;
  label: string;
  status: RevisaoItemStatus;
  detalhe: string;
}

/** Uma decisão de revisão interna já registada (histórico). */
export interface RevisaoDecisaoDTO {
  id: string;
  resultado: "aprovada" | "devolvida";
  comentarios: string | null;
  revisorNome: string;
  createdAt: string;
}

/** Estado completo do painel de revisão interna (A3). */
export interface RevisaoInternaDTO {
  stage: "A2" | "A3" | "A4";
  checklist: RevisaoChecklistItemDTO[];
  /** o solicitante tem a permissão E a candidatura está em A3 */
  podeAprovar: boolean;
  /** nº de itens da checklist com estado "falha" */
  bloqueios: number;
  historico: RevisaoDecisaoDTO[];
}

/**
 * Deriva o estado de um item da checklist a partir de três sinais possíveis:
 *  - `ok`            quando a condição está cumprida;
 *  - `indeterminado` quando não há dados para avaliar (ex.: sem grelha/checklist);
 *  - `falha`         caso contrário.
 *
 * Função pura, isolada para teste unitário (a recolha dos sinais é feita na API
 * a partir da base de dados).
 */
export function deriveRevisaoItemStatus(
  ok: boolean,
  indeterminado: boolean,
): RevisaoItemStatus {
  if (indeterminado) return "indeterminado";
  return ok ? "ok" : "falha";
}

/** Nº de bloqueios (itens em "falha") de uma checklist de revisão. */
export function contarBloqueios(itens: readonly RevisaoChecklistItemDTO[]): number {
  return itens.filter((i) => i.status === "falha").length;
}
