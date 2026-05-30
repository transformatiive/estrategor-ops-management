import type { ProgramCode } from "./enums.js";

/**
 * Taxonomia oficial de documentos (spec §5 — Checklist de Candidatura a Sistemas
 * de Incentivos). Cada tipo mapeia para uma pasta-alvo no WorkDrive (Épico C/E) e
 * indica a que programas se aplica. `appliesTo: "all"` = aplicável a todos.
 *
 * Esta lista alimenta a geração da checklist por projeto (D-01) e a classificação
 * por IA (E-01). É a fonte única dos tipos de documento na Semana 1; pode ser
 * movida para a tabela `document_types` no seed.
 */
export interface DocumentTypeDef {
  /** chave estável (snake/upper) usada em código e na classificação por IA */
  key: string;
  /** nome legível PT-PT */
  name: string;
  /** descrição/finalidade do documento */
  purpose: string;
  /** programas a que se aplica, ou "all" */
  appliesTo: ProgramCode[] | "all";
  /** pasta-alvo (caminho relativo) na árvore WorkDrive do cliente */
  targetFolder: string;
  /** documento com validade limitada → gerar alerta */
  hasExpiry?: boolean;
}

export const DOCUMENT_TAXONOMY: DocumentTypeDef[] = [
  {
    key: "CERTIDAO_PERMANENTE",
    name: "Certidão Permanente",
    purpose: "Identificação e situação jurídica da empresa.",
    appliesTo: "all",
    targetFolder: "ELEMENTOS",
  },
  {
    key: "CERTIFICADO_PME",
    name: "Certificado PME (IAPMEI)",
    purpose: "Estatuto PME — validade limitada.",
    appliesTo: "all",
    targetFolder: "ELEMENTOS",
    hasExpiry: true,
  },
  {
    key: "CERTIDAO_NAO_DIVIDA",
    name: "Certidão de não dívida (AT e Segurança Social)",
    purpose: "Regularidade fiscal e contributiva.",
    appliesTo: "all",
    targetFolder: "ELEMENTOS",
    hasExpiry: true,
  },
  {
    key: "RCBE",
    name: "RCBE",
    purpose: "Registo de beneficiário efetivo.",
    appliesTo: "all",
    targetFolder: "ELEMENTOS",
  },
  {
    key: "IES",
    name: "IES (3 anos)",
    purpose: "Demonstrações financeiras dos últimos 3 anos.",
    appliesTo: "all",
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "MODELO_22",
    name: "Modelo 22 + balancetes",
    purpose: "Suporte fiscal/contabilístico.",
    appliesTo: "all",
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "MAPA_DEPRECIACOES",
    name: "Mapa de depreciações / Anexo A e B Relatório Único",
    purpose: "Investimento e emprego.",
    appliesTo: ["PT2030", "RFAI", "SIFIDE"],
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "MAPAS_SEG_SOCIAL",
    name: "Mapas da Segurança Social / listagem de pessoal",
    purpose: "Quadro de pessoal e ETI.",
    appliesTo: "all",
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "MAPA_VENDAS",
    name: "Mapa de vendas",
    purpose: "Vendas por mercado.",
    appliesTo: ["PT2030", "RFAI"],
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "INTENCOES_INVESTIMENTO",
    name: "Intenções de investimento + orçamentos",
    purpose: "Base do PGI (designação, montante, fornecedor, calendário).",
    appliesTo: ["PT2030", "RFAI"],
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "LICENCIAMENTOS",
    name: "Licenciamentos / financiamento",
    purpose: "Condições de acesso (específico por setor).",
    appliesTo: ["PT2030"],
    targetFolder: "INCENTIVOS/Candidatura",
  },
  {
    key: "TURISMO_MEMORIA",
    name: "Setor Turismo: memória, peças desenhadas, ofícios",
    purpose: "Apenas setores específicos (Turismo).",
    appliesTo: ["PT2030"],
    targetFolder: "INCENTIVOS/Candidatura",
  },
];

/**
 * Estrutura de pastas no WorkDrive por projecto (spec §6, v2026-05-30). A raiz é
 * a pasta do projecto; a subárvore depende do `programa`. Caminhos com prefixos
 * numéricos para ordenação estável.
 *
 * ```
 * 0-ELEMENTOS/
 * 1-INCENTIVOS/{SI <medida> nº xxxx}/{Candidatura, Submissão, Análise..., Termo de Aceitação, Execução}
 * 2-BF/{RFAI, SIFIDE}
 * 3-FORMAÇÃO/
 * ```
 */
export interface FolderNode {
  /** caminho lógico relativo à raiz do projecto, ex.: "1-INCENTIVOS/Candidatura" */
  path: string;
  /** nome da pasta (último segmento) */
  name: string;
  /** caminho do pai, ou null para os nós de topo */
  parentPath: string | null;
}

const INCENTIVOS_SUB = [
  "Candidatura",
  "Submissão",
  "Análise + Pedido de Elementos + Decisão",
  "Termo de Aceitação",
  "Execução",
];

/**
 * Constrói a lista achatada (pai antes dos filhos) da árvore de pastas para um
 * projecto, conforme o programa. `measureLabel` nomeia a pasta da medida dentro
 * de 1-INCENTIVOS (ex.: "SI Qualificação nº 0182"); se ausente, usa um genérico.
 */
export function buildFolderTree(
  program: ProgramCode,
  measureLabel?: string,
): FolderNode[] {
  const nodes: FolderNode[] = [];
  const add = (path: string, parentPath: string | null) =>
    nodes.push({ path, name: path.split("/").pop()!, parentPath });

  // 0-ELEMENTOS — sempre
  add("0-ELEMENTOS", null);

  if (program === "PT2030") {
    add("1-INCENTIVOS", null);
    const measure = measureLabel?.trim() || "SI nº —";
    const base = `1-INCENTIVOS/${measure}`;
    add(base, "1-INCENTIVOS");
    for (const sub of INCENTIVOS_SUB) add(`${base}/${sub}`, base);
  }

  if (program === "RFAI" || program === "SIFIDE") {
    add("2-BF", null);
    add(`2-BF/${program}`, "2-BF");
  }

  if (program === "FORMACAO") {
    add("3-FORMAÇÃO", null);
  }

  return nodes;
}

/** Devolve os tipos de documento aplicáveis a um dado programa. */
export function documentTypesForProgram(program: ProgramCode): DocumentTypeDef[] {
  return DOCUMENT_TAXONOMY.filter(
    (d) => d.appliesTo === "all" || d.appliesTo.includes(program),
  );
}
