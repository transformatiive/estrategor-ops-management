/**
 * Fontes de contexto da Preparação (TRNSF-1068 · item 1).
 *
 * O consultor junta fontes descritivas — texto colado de emails, descrição do
 * projeto, candidaturas anteriores, memória descritiva, mapas (como documento) —
 * que passam a alimentar o motor de geração da candidatura. A montagem do bloco
 * injetado é pura e testável (`assembleContexto`).
 */

export const CAND_CONTEXT_KINDS = ["texto", "email", "precedente", "documento"] as const;
export type CandContextKind = (typeof CAND_CONTEXT_KINDS)[number];

export const CAND_CONTEXT_KIND_LABELS: Record<CandContextKind, string> = {
  texto: "Texto / descrição",
  email: "Email",
  precedente: "Candidatura anterior",
  documento: "Documento",
};

export interface CandContextSourceDTO {
  id: string;
  kind: CandContextKind;
  label: string;
  /** primeiros caracteres do conteúdo, para pré-visualização na UI */
  preview: string;
  chars: number;
  documentId: string | null;
  createdAt: string;
}

/** Teto de caracteres do bloco "CONTEXTO E PRECEDENTES" injetado na geração. */
export const CONTEXT_BUDGET_CHARS = 14000;

/**
 * Monta o bloco de contexto a partir das fontes, respeitando um orçamento de
 * caracteres (trunca a última fonte que não couber). Puro — sem BD nem IO.
 */
export function assembleContexto(
  sources: { kind: CandContextKind; label: string; content: string }[],
  budget = CONTEXT_BUDGET_CHARS,
): string {
  const blocks: string[] = [];
  let used = 0;
  for (const s of sources) {
    const head = `### ${CAND_CONTEXT_KIND_LABELS[s.kind] ?? s.kind} — ${s.label}`;
    const remaining = budget - used - head.length - 2;
    if (remaining <= 0) break;
    const body = s.content.length > remaining ? `${s.content.slice(0, remaining)}…` : s.content;
    const block = `${head}\n${body}`;
    blocks.push(block);
    used += block.length + 2;
  }
  return blocks.join("\n\n");
}
