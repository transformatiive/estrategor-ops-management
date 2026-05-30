import type { DocConfidence } from "./enums.js";

/**
 * DTOs do separador Documentos / fila de validação (TRNSF-938).
 */

export type DocumentStatus =
  | "em_analise"
  | "a_validar"
  | "arquivado"
  | "rejeitado"
  | "dividido";

/** Um documento (na fila de validação ou já arquivado). */
export interface DocumentDTO {
  id: string;
  status: DocumentStatus;
  originalFilename: string;
  storedFilename: string | null;
  origin: "CLIENTE" | "MANUAL";
  /** tipo confirmado (após validação) */
  documentTypeKey: string | null;
  documentTypeName: string | null;
  /** tipo proposto pela IA (antes da validação) */
  proposedTypeKey: string | null;
  proposedTypeName: string | null;
  confidence: DocConfidence;
  confidenceScore: number | null;
  /** intervalo de páginas (quando é uma parte de um ficheiro dividido) */
  pageStart: number | null;
  pageEnd: number | null;
  parentDocumentId: string | null;
  workdriveUrl: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  createdAt: string;
}

/** Estado do separador Documentos de um projecto. */
export interface ProjectDocumentsDTO {
  /** documentos a aguardar validação humana (fila) */
  queue: DocumentDTO[];
  /** documentos já validados/arquivados */
  archived: DocumentDTO[];
}

/** Validar (confirmar/corrigir) a classificação de um documento. */
export interface ValidateDocumentRequest {
  /** tipo de documento confirmado pelo consultor */
  documentTypeKey: string;
}
