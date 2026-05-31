/**
 * Pesquisa global (topbar). Procura em Projetos, Clientes e Documentos, com
 * resultados agrupados por secção. Respeita a visibilidade do utilizador
 * (gestor vê tudo; consultor vê os seus projetos).
 */

export interface SearchProjetoHit {
  id: string;
  title: string;
  code: string;
  clientName: string;
  /** fase em linguagem de cliente */
  badgeLabel: string;
}

export interface SearchClienteHit {
  id: string;
  name: string;
  sector: string | null;
}

export interface SearchDocumentoHit {
  id: string;
  projectId: string;
  projectTitle: string;
  tipo: string;
  status: string;
}

export interface SearchResultsDTO {
  projetos: SearchProjetoHit[];
  clientes: SearchClienteHit[];
  documentos: SearchDocumentoHit[];
  total: number;
}

/** Comprimento mínimo da pesquisa para disparar resultados. */
export const SEARCH_MIN_CHARS = 2;
