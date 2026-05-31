import type { ExtractedField, ExtractMethod } from "@estrategor/shared";

/** Entrada de um extractor: o documento já arquivado + o seu conteúdo binário. */
export interface ExtractInput {
  documentId: string;
  tipoDocumento: string;
  filename: string;
  mimeType: string;
  content: Buffer;
}

/** Resultado de um extractor (determinístico ou IA). */
export interface ExtractorOutput {
  metodo: ExtractMethod;
  /** confiança global 0..1; null nos determinísticos (leitura exata) */
  confianca: number | null;
  campos: ExtractedField[];
  /** nota quando algo não correu como esperado (orienta a validação humana) */
  nota: string | null;
}

/** Resultado vazio (sem campos) — sinaliza ao motor que deve tentar o fallback. */
export function emptyOutput(metodo: ExtractMethod, nota: string | null): ExtractorOutput {
  return { metodo, confianca: metodo === "ia" ? 0 : null, campos: [], nota };
}
