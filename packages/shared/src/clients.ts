/**
 * Clientes (Configuração) — lista de clientes com projetos em curso e detalhe
 * no contexto dos projetos (candidatura/execução) + documentação associada.
 */

import type { CandFamily } from "./candidatura.js";
import type { ProjectState } from "./enums.js";

export interface ClientListItemDTO {
  id: string;
  name: string;
  sector: string | null;
  nif: string | null;
  /** projetos em curso (candidatura ou execução) */
  numProjetos: number;
}

export interface ClientProjetoDTO {
  id: string;
  code: string;
  title: string;
  programCode: string;
  programName: string;
  family: CandFamily | null;
  state: ProjectState;
  /** estado em linguagem de cliente */
  badgeLabel: string;
  progress: number;
}

export interface ClientDocumentoDTO {
  id: string;
  projectId: string;
  projectTitle: string;
  tipo: string;
  status: string;
  workdriveUrl: string | null;
  createdAt: string;
}

export interface ClientDetailDTO {
  id: string;
  name: string;
  nif: string | null;
  sector: string | null;
  projetos: ClientProjetoDTO[];
  documentos: ClientDocumentoDTO[];
}
