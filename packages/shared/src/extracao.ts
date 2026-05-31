/**
 * Motor de Extração de Dados (TRNSF-952) — contrato partilhado API ↔ Web.
 *
 * Liga os documentos arquivados (TRNSF-938) aos campos da candidatura
 * (TRNSF-942): o que o cliente envia vira matéria-prima que pré-preenche a
 * candidatura. Regra de ouro:
 *   1. determinístico primeiro (ler ficheiros estruturados com código);
 *   2. fallback para IA com confiança por campo quando não há estrutura.
 * Nada com `origem='extraido'` é final sem validação humana (a extração entra
 * na mesma fila de "IA propõe, humano valida").
 */

import type { FieldState } from "./candidatura.js";

/** Método usado para extrair (determinístico = código; ia = modelo de linguagem). */
export const EXTRACT_METHODS = ["deterministico", "ia"] as const;
export type ExtractMethod = (typeof EXTRACT_METHODS)[number];

export const EXTRACT_METHOD_LABELS: Record<ExtractMethod, string> = {
  deterministico: "Lido por código",
  ia: "Extraído por IA",
};

/**
 * Mapeamento documento → campos-alvo (regra de ouro do ticket). É DADOS: liga a
 * taxonomia (TRNSF-953/938) às secções da candidatura (TRNSF-942). Acrescentar
 * um extractor é acrescentar uma linha aqui + a implementação respetiva.
 *
 * `metodo` indica o caminho preferido; os extractores determinísticos caem para
 * IA quando o ficheiro não tem a estrutura esperada.
 */
export interface ExtractorTarget {
  /** chave do tipo de documento (DOCUMENT_TAXONOMY) */
  tipoDocumento: string;
  /** método preferido */
  metodo: ExtractMethod;
  /** secção(ões) da candidatura que este documento alimenta */
  secoes: string[];
  /** descrição legível do que se extrai */
  descricao: string;
}

export const EXTRACTOR_TARGETS: ExtractorTarget[] = [
  {
    tipoDocumento: "IES",
    metodo: "deterministico",
    secoes: ["financeiro"],
    descricao: "Balanço + Demonstração de Resultados por ano (estrutura SNC).",
  },
  {
    tipoDocumento: "MODELO_22",
    metodo: "deterministico",
    secoes: ["financeiro"],
    descricao: "Balancetes/suporte contabilístico (estrutura SNC).",
  },
  {
    tipoDocumento: "MAPA_VENDAS",
    metodo: "deterministico",
    secoes: ["mercado_linhas", "exportacoes_indiretas"],
    descricao: "Vendas por mercado/produto (mapa Excel da Estrategor).",
  },
  {
    tipoDocumento: "MAPAS_SEG_SOCIAL",
    metodo: "deterministico",
    secoes: ["beneficiario"],
    descricao: "Quadro de pessoal e ETI (emprego).",
  },
  {
    tipoDocumento: "CERTIDAO_PERMANENTE",
    metodo: "ia",
    secoes: ["beneficiario"],
    descricao: "NIF, nome, CAE, natureza jurídica e capital social.",
  },
  {
    tipoDocumento: "RCBE",
    metodo: "ia",
    secoes: ["beneficiario"],
    descricao: "Estado do registo de beneficiário efetivo.",
  },
  {
    tipoDocumento: "INTENCOES_INVESTIMENTO",
    metodo: "ia",
    secoes: ["investimentos"],
    descricao: "Linhas de investimento (designação, montante, fornecedor).",
  },
];

export function extractorFor(tipoDocumento: string): ExtractorTarget | undefined {
  return EXTRACTOR_TARGETS.find((e) => e.tipoDocumento === tipoDocumento);
}

export function hasExtractor(tipoDocumento: string): boolean {
  return EXTRACTOR_TARGETS.some((e) => e.tipoDocumento === tipoDocumento);
}

// ─── Campos extraídos (payload guardado em Extracao.campos_extraidos) ─────────

/**
 * Um candidato a campo da candidatura, produzido por um extractor. `confianca`
 * é null nos extractores determinísticos (leitura exata) e 0..1 na IA.
 */
export interface ExtractedField {
  /** secção-alvo na candidatura (chave de CAND_COMMON_SECTIONS ou específica) */
  section: string;
  /** chave do campo dentro da secção */
  key: string;
  /** rótulo legível PT-PT (para a fila de validação) */
  label: string;
  /** valor extraído (texto, número, data ou tabela) */
  value: unknown;
  /** confiança por campo (0..1) — null = determinístico */
  confianca: number | null;
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface ExtractaoFieldDTO extends ExtractedField {
  /** o mesmo (section,key) é proposto por outra extração por validar → conflito */
  conflito: boolean;
}

export interface ExtractaoDTO {
  id: string;
  documentId: string;
  documentName: string;
  tipoDocumento: string;
  tipoDocumentoLabel: string;
  metodo: ExtractMethod;
  /** confiança global (0..1) — null nos determinísticos */
  confianca: number | null;
  estado: FieldState;
  campos: ExtractaoFieldDTO[];
  /** nota do extractor (ex.: "IA indisponível", "sem estrutura reconhecida") */
  nota: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  createdAt: string;
}

/** Conflito entre fontes: o mesmo campo-alvo extraído de dois documentos. */
export interface ExtractaoConflictDTO {
  section: string;
  key: string;
  label: string;
  /** extrações (id + documento) que disputam este campo */
  fontes: { extracaoId: string; documentName: string; value: unknown }[];
}

/** Estado do separador Extração de um projecto. */
export interface ProjectExtracoesDTO {
  /** null quando a candidatura ainda não foi iniciada */
  candidaturaId: string | null;
  /** extrações por validar (fila) */
  queue: ExtractaoDTO[];
  /** extrações já processadas (validadas/corrigidas) */
  processed: ExtractaoDTO[];
  /** conflitos entre fontes (assinalados, nunca resolvidos em silêncio) */
  conflicts: ExtractaoConflictDTO[];
}

/** Confirmar uma extração: aceitar/corrigir cada campo → escreve na candidatura. */
export interface ValidateExtracaoRequest {
  fields: {
    section: string;
    key: string;
    /** valor a gravar (se corrigido); ausente = aceitar o valor extraído */
    value?: unknown;
    /** false = ignorar este campo (não escrever na candidatura) */
    accept: boolean;
  }[];
}
