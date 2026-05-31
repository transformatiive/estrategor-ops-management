/**
 * Motor de Geração IA dos campos de texto (TRNSF-943) — contrato partilhado.
 *
 * A candidatura tem ~20 campos de texto livre, cada um com o seu limite e os
 * seus "ingredientes" (o que tem de cobrir). A IA redige uma minuta para o
 * consultor refinar — nunca escreve do zero nem inventa. Cada campo gerado
 * preenche um CandField (TRNSF-942) com origem='gerado', estado='por_validar'.
 *
 * O catálogo de doc_types é DADOS (não código): acrescentar/afinar um campo é
 * acrescentar/editar uma linha aqui. Os ingredientes detalhados vêm do
 * levantamento estrutural dos formulários e são refináveis sem alterar código.
 */

import type { CandFamily } from "./candidatura.js";
import type { FieldState } from "./candidatura.js";

/** Rota de modelo recomendada por campo (campos longos/argumentativos → opus). */
export const GEN_MODELS = ["opus", "sonnet"] as const;
export type GenModel = (typeof GEN_MODELS)[number];

/** Âmbito do campo: comum às duas famílias, ou específico de uma. */
export type GenScope = "comum" | CandFamily;

export interface GenDocTypeDef {
  /** chave estável do tipo de campo gerado */
  docType: string;
  scope: GenScope;
  /** secção + chave do CandField que este campo preenche (TRNSF-942) */
  section: string;
  key: string;
  /** rótulo legível PT-PT */
  label: string;
  /** limite de caracteres (alvo 95–99%) */
  charLimit: number;
  /** rota de modelo recomendada */
  model: GenModel;
  /** o que o campo tem de cobrir (carregado no prompt como ingredientes_especificos) */
  ingredientes: string;
  /** condicional: só gerar quando se aplica (assinalado ao consultor) */
  condicional?: boolean;
}

export const GEN_DOC_TYPES: GenDocTypeDef[] = [
  // ── Comuns às duas famílias ──────────────────────────────────────────────
  {
    docType: "descricao_operacao_resumo_pt",
    scope: "comum",
    section: "descricao_operacao",
    key: "resumo_pt",
    label: "Resumo da operação (PT)",
    charLimit: 5000,
    model: "opus",
    ingredientes:
      "Síntese da operação numa frase inicial + padrão/contributo ambiental; sub-rótulo \"Principais objetivos da operação:\" seguido de 3-5 bullets.",
  },
  {
    docType: "descricao_operacao_resumo_en",
    scope: "comum",
    section: "descricao_operacao",
    key: "resumo_en",
    label: "Resumo da operação (EN)",
    charLimit: 5000,
    model: "sonnet",
    ingredientes: "Tradução fiel para inglês do resumo PT, mantendo estrutura e objetivos.",
  },
  {
    docType: "descricao_operacao_objetivos",
    scope: "comum",
    section: "descricao_operacao",
    key: "objetivos",
    label: "Objetivos da operação",
    charLimit: 5000,
    model: "opus",
    ingredientes: "Objetivos estratégicos e operacionais, ligados aos resultados esperados e aos indicadores.",
  },
  {
    docType: "descricao_operacao_descricao_tecnica",
    scope: "comum",
    section: "descricao_operacao",
    key: "descricao_tecnica",
    label: "Descrição técnica",
    charLimit: 5000,
    model: "opus",
    ingredientes: "Descrição técnica do investimento: solução, tecnologia, fases e meios; ligação às atividades de inovação.",
  },
  {
    docType: "descricao_operacao_diagnostico",
    scope: "comum",
    section: "descricao_operacao",
    key: "diagnostico",
    label: "Diagnóstico (SWOT)",
    charLimit: 5000,
    model: "opus",
    ingredientes: "Diagnóstico em estrutura SWOT: FORÇAS, FRAQUEZAS, OPORTUNIDADES, AMEAÇAS (sub-rótulos + bullets).",
  },
  {
    docType: "enquadramento_tematico_fundamentacao",
    scope: "comum",
    section: "enquadramento_tematico",
    key: "fundamentacao",
    label: "Enquadramento temático (EREI) — fundamentação",
    charLimit: 9000,
    model: "opus",
    ingredientes:
      "Fundamentação do enquadramento na EREI da região: domínio prioritário, alinhamento da operação e contributo (uma por região).",
  },

  // ── Família A — Inovação Produtiva ────────────────────────────────────────
  {
    docType: "analise_mercado_descricao_atividade",
    scope: "inovacao_produtiva",
    section: "analise_mercado",
    key: "descricao_atividade",
    label: "Análise de mercado — descrição da atividade",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Caracterização da atividade económica da empresa e do seu posicionamento.",
  },
  {
    docType: "analise_mercado_mercados_atuais",
    scope: "inovacao_produtiva",
    section: "analise_mercado",
    key: "mercados_atuais",
    label: "Análise de mercado — mercados atuais",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Mercados atuais (geografias, segmentos, clientes), com dados de vendas quando existirem.",
  },
  {
    docType: "analise_mercado_novos_mercados",
    scope: "inovacao_produtiva",
    section: "analise_mercado",
    key: "novos_mercados",
    label: "Análise de mercado — novos mercados",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Novos mercados-alvo e justificação da sua escolha.",
  },
  {
    docType: "analise_mercado_estrategia_captacao",
    scope: "inovacao_produtiva",
    section: "analise_mercado",
    key: "estrategia_captacao",
    label: "Análise de mercado — estratégia de captação",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Estratégia de captação organizada pelos 4 P's (Produto, Preço, Distribuição, Promoção).",
  },
  {
    docType: "analise_mercado_capacidade",
    scope: "inovacao_produtiva",
    section: "analise_mercado",
    key: "capacidade",
    label: "Análise de mercado — capacidade",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Capacidade produtiva atual e após o investimento; resposta à procura prevista.",
  },
  {
    docType: "tipologia_fundamentacao",
    scope: "inovacao_produtiva",
    section: "tipologia",
    key: "fundamentacao",
    label: "Fundamentação da tipologia",
    charLimit: 4500,
    model: "opus",
    ingredientes: "Fundamentação do enquadramento na tipologia de investimento (uma por tipologia).",
  },
  {
    docType: "atividade_caracterizacao",
    scope: "inovacao_produtiva",
    section: "atividades_inovacao",
    key: "caracterizacao",
    label: "Caracterização da atividade de inovação",
    charLimit: 4500,
    model: "opus",
    ingredientes: "Caracterização de cada atividade de inovação: natureza, novidade, meios e resultados (uma por atividade).",
  },
  {
    docType: "industria_40_inovacao_produto",
    scope: "inovacao_produtiva",
    section: "industria_40",
    key: "inovacao_produto",
    label: "Indústria 4.0 — inovação de produto",
    charLimit: 1000,
    model: "sonnet",
    ingredientes: "Inovação de produto introduzida pela operação.",
  },
  {
    docType: "industria_40_inovacao_processo",
    scope: "inovacao_produtiva",
    section: "industria_40",
    key: "inovacao_processo",
    label: "Indústria 4.0 — inovação de processo",
    charLimit: 1000,
    model: "sonnet",
    ingredientes: "Inovação de processo introduzida pela operação.",
  },
  {
    docType: "industria_40_inovacao_organizacional",
    scope: "inovacao_produtiva",
    section: "industria_40",
    key: "inovacao_organizacional",
    label: "Indústria 4.0 — inovação organizacional",
    charLimit: 1000,
    model: "sonnet",
    ingredientes: "Inovação organizacional introduzida pela operação.",
  },
  {
    docType: "industria_40_inovacao_marketing",
    scope: "inovacao_produtiva",
    section: "industria_40",
    key: "inovacao_marketing",
    label: "Indústria 4.0 — inovação de marketing",
    charLimit: 1000,
    model: "sonnet",
    ingredientes: "Inovação de marketing introduzida pela operação.",
  },
  {
    docType: "transicao_climatica_fundamentacao",
    scope: "inovacao_produtiva",
    section: "transicao_climatica",
    key: "fundamentacao",
    label: "Transição climática — fundamentação",
    charLimit: 3000,
    model: "opus",
    ingredientes: "Fundamentação do contributo para a transição climática, por âmbito aplicável.",
  },
  {
    docType: "procedimentos_aquisitivos",
    scope: "inovacao_produtiva",
    section: "procedimentos",
    key: "aquisitivos",
    label: "Procedimentos aquisitivos",
    charLimit: 3000,
    model: "sonnet",
    ingredientes: "Descrição do processo de seleção de fornecedores e procedimentos aquisitivos.",
  },
  {
    docType: "fundamentacao_indicadores_rpa",
    scope: "inovacao_produtiva",
    section: "indicadores",
    key: "fundamentacao_rpa",
    label: "Fundamentação dos indicadores RPA",
    charLimit: 1500,
    model: "sonnet",
    condicional: true,
    ingredientes: "Fundamentação dos indicadores RPA de transição climática (só se houver indicadores RPA).",
  },

  // ── Família B — Internacionalização ───────────────────────────────────────
  {
    docType: "intl_project_description",
    scope: "internacionalizacao",
    section: "descricao_operacao",
    key: "intl_project_description",
    label: "Descrição do projeto de internacionalização",
    charLimit: 3000,
    model: "opus",
    ingredientes: "Contributo do conjunto das ações para a estratégia de internacionalização da empresa.",
  },
  {
    docType: "intl_action_descricao",
    scope: "internacionalizacao",
    section: "acoes_intl",
    key: "descricao",
    label: "Ação de internacionalização — descrição",
    charLimit: 1500,
    model: "sonnet",
    ingredientes:
      "Caracterização do evento/ação + objetivo + enquadramento na estratégia, num parágrafo conciso (uma por ação).",
  },
  {
    docType: "intl_action_fundamentacao_inov_marketing",
    scope: "internacionalizacao",
    section: "acoes_intl",
    key: "fund_inov_marketing",
    label: "Ação — fundamentação inovação de marketing",
    charLimit: 1500,
    model: "sonnet",
    ingredientes: "Fundamentação da inovação de marketing associada à ação (uma por ação).",
  },
  {
    docType: "intl_action_fundamentacao_inov_organizacional",
    scope: "internacionalizacao",
    section: "acoes_intl",
    key: "fund_inov_organizacional",
    label: "Ação — fundamentação inovação organizacional",
    charLimit: 1500,
    model: "sonnet",
    condicional: true,
    ingredientes: "Fundamentação da inovação organizacional associada à ação (condicional, uma por ação).",
  },
];

/** doc_types aplicáveis a uma família (comuns + específicos dessa família). */
export function genDocTypesForFamily(family: CandFamily): GenDocTypeDef[] {
  return GEN_DOC_TYPES.filter((d) => d.scope === "comum" || d.scope === family);
}

export function genDocType(docType: string): GenDocTypeDef | undefined {
  return GEN_DOC_TYPES.find((d) => d.docType === docType);
}

/** Procura o doc_type que preenche um dado (section, key) do CandField. */
export function genDocTypeByTarget(section: string, key: string): GenDocTypeDef | undefined {
  return GEN_DOC_TYPES.find((d) => d.section === section && d.key === key);
}

/** Marcador de informação em falta — a IA nunca inventa, sinaliza com isto. */
export const PLACEHOLDER_RE = /\[A PREENCHER:[^\]]*\]/g;

export function countPlaceholders(text: string): number {
  return (text.match(PLACEHOLDER_RE) ?? []).length;
}

/**
 * Minuta de arranque quando não há IA (sem chave) ou esta falha. NÃO inventa:
 * devolve a estrutura com marcadores [A PREENCHER] a partir dos ingredientes,
 * para o consultor preencher manualmente.
 */
export function stubDraft(def: GenDocTypeDef): string {
  return (
    `[A PREENCHER: ${def.ingredientes}]\n\n` +
    `(Minuta automática indisponível — sem motor de IA configurado. ` +
    `Preencha este campo "${def.label}" até ${def.charLimit} caracteres com base no dossier.)`
  );
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface GeneratedFieldDTO {
  docType: string;
  label: string;
  section: string;
  key: string;
  scope: GenScope;
  charLimit: number;
  model: GenModel;
  condicional: boolean;
  /** estado do CandField correspondente, ou null se ainda por gerar */
  estado: FieldState | null;
  /** conteúdo atual (do CandField), ou null se por gerar */
  conteudo: string | null;
  charCount: number;
  /** excede o limite de caracteres (assinalar antes de dar por pronto) */
  excedeLimite: boolean;
  /** n.º de marcadores [A PREENCHER: ...] por resolver */
  placeholders: number;
  versao: number;
}

export interface CandidaturaGeracaoDTO {
  candidaturaId: string;
  family: CandFamily;
  /** configuração mínima presente (aviso + grelha); senão, não gerar às cegas */
  configMissing: string | null;
  campos: GeneratedFieldDTO[];
}

export interface GerarMinutaRequest {
  docType: string;
}
