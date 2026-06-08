/**
 * Núcleo da Candidatura (TRNSF-942) — tipos e catálogo de secções comuns.
 *
 * Este ficheiro é o contrato partilhado entre API e Web. Define:
 *  - a família do sistema de incentivos;
 *  - a proveniência por campo (origem + estado);
 *  - o catálogo das secções COMUNS às duas famílias (cand_*), por onde o
 *    preview se organiza. As secções/tabelas específicas de cada família
 *    entram nos tickets próprios e ligam-se à mesma candidatura.
 */

export const CAND_FAMILIES = [
  "inovacao_produtiva",
  "internacionalizacao",
  "qualificacao",
] as const;
export type CandFamily = (typeof CAND_FAMILIES)[number];

/** Famílias disponíveis para escolha em v0 (qualificacao fica fora de âmbito). */
export const CAND_FAMILIES_V0: CandFamily[] = ["inovacao_produtiva", "internacionalizacao"];

export const CAND_FAMILY_LABELS: Record<CandFamily, string> = {
  inovacao_produtiva: "Inovação Produtiva",
  internacionalizacao: "Internacionalização",
  qualificacao: "Qualificação",
};

export const CAND_STAGES = ["A2", "A3", "A4"] as const;
export type CandStage = (typeof CAND_STAGES)[number];

/** Rótulos de fase em linguagem de cliente (os códigos A2/A3/A4 são internos). */
export const CAND_STAGE_LABELS: Record<CandStage, string> = {
  A2: "Em preparação",
  A3: "Em revisão interna",
  A4: "Pronto para submissão",
};

export const FIELD_ORIGINS = [
  "extraido",
  "intake",
  "gerado",
  "calculado",
  "oficial_vies",
  "api_empresas",
  "pre_diagnostico_ia",
] as const;
export type FieldOrigin = (typeof FIELD_ORIGINS)[number];

export const FIELD_STATES = ["por_validar", "validado", "corrigido"] as const;
export type FieldState = (typeof FIELD_STATES)[number];

/** Rótulos e indicadores visuais da proveniência (para o preview). */
export const FIELD_ORIGIN_LABELS: Record<FieldOrigin, string> = {
  extraido: "Extraído de documento",
  intake: "Fornecido pelo cliente",
  gerado: "Gerado por IA",
  calculado: "Calculado",
  oficial_vies: "Oficial (VIES)",
  api_empresas: "API de empresas",
  pre_diagnostico_ia: "Pré-diagnóstico (IA)",
};

export const FIELD_STATE_LABELS: Record<FieldState, string> = {
  por_validar: "Por validar",
  validado: "Validado",
  corrigido: "Corrigido",
};

/** Indicador visual por estado (usado no preview). */
export const FIELD_STATE_BADGE: Record<FieldState, { icon: string; cls: string }> = {
  por_validar: { icon: "🟡", cls: "field-por-validar" },
  validado: { icon: "🟢", cls: "field-validado" },
  corrigido: { icon: "✏️", cls: "field-corrigido" },
};

/**
 * Regra transversal (TRNSF-942/967): campos `extraido`, `gerado`, `api_empresas`
 * e `pre_diagnostico_ia` não são finais sem passar a `validado`/`corrigido`.
 * `intake`, `calculado` e `oficial_vies` (fonte estatal) não exigem validação
 * humana obrigatória (mas podem ser corrigidos).
 */
export function requiresHumanValidation(origin: FieldOrigin): boolean {
  return (
    origin === "extraido" ||
    origin === "gerado" ||
    origin === "api_empresas" ||
    origin === "pre_diagnostico_ia"
  );
}

export function isFieldFinal(origin: FieldOrigin, state: FieldState): boolean {
  if (!requiresHumanValidation(origin)) return true;
  return state === "validado" || state === "corrigido";
}

// ─── Catálogo de secções comuns (cand_*) ─────────────────────────────────
// Cada secção tem uma chave estável, um nome legível, e a referência ao número
// de secção no formulário SGO por família. A origem-base indica de onde o
// conteúdo costuma vir (orienta o preview e os motores nos tickets seguintes).

export interface CandSectionDef {
  key: string;
  name: string;
  /** secção no formulário, por família (informativo) */
  sgo: { inovacao_produtiva?: string; internacionalizacao?: string };
  /** origem predominante do conteúdo desta secção */
  baseOrigin: FieldOrigin;
}

/** Secções comuns às duas famílias (TRNSF-942 · "Modelo de dados comum"). */
export const CAND_COMMON_SECTIONS: CandSectionDef[] = [
  { key: "declaracoes", name: "Declarações e elegibilidade", sgo: { inovacao_produtiva: "1", internacionalizacao: "18" }, baseOrigin: "intake" },
  { key: "beneficiario", name: "Identificação do beneficiário", sgo: { inovacao_produtiva: "2", internacionalizacao: "1" }, baseOrigin: "extraido" },
  { key: "unidade_economica", name: "Unidade económica e participações", sgo: { inovacao_produtiva: "3", internacionalizacao: "2" }, baseOrigin: "extraido" },
  { key: "analise_mercado", name: "Análise de mercado", sgo: { inovacao_produtiva: "4", internacionalizacao: "3" }, baseOrigin: "gerado" },
  { key: "mercado_linhas", name: "Atividade económica por mercado", sgo: { inovacao_produtiva: "5", internacionalizacao: "4" }, baseOrigin: "intake" },
  { key: "exportacoes_indiretas", name: "Exportações indiretas", sgo: { inovacao_produtiva: "6", internacionalizacao: "5" }, baseOrigin: "intake" },
  { key: "financeiro", name: "Componente financeira", sgo: { inovacao_produtiva: "8", internacionalizacao: "6" }, baseOrigin: "extraido" },
  { key: "localizacoes", name: "Localização da operação", sgo: { inovacao_produtiva: "9.3", internacionalizacao: "7" }, baseOrigin: "intake" },
  { key: "contactos", name: "Contactos do projeto", sgo: { inovacao_produtiva: "9.7", internacionalizacao: "7" }, baseOrigin: "intake" },
  { key: "enquadramento_tematico", name: "Enquadramento temático (EREI)", sgo: { inovacao_produtiva: "19", internacionalizacao: "15" }, baseOrigin: "gerado" },
  { key: "efeito_incentivo", name: "Efeito incentivo", sgo: { inovacao_produtiva: "21", internacionalizacao: "17" }, baseOrigin: "intake" },
  { key: "anexos", name: "Anexos", sgo: { inovacao_produtiva: "22", internacionalizacao: "19" }, baseOrigin: "intake" },
];

export function commonSection(key: string): CandSectionDef | undefined {
  return CAND_COMMON_SECTIONS.find((s) => s.key === key);
}

/**
 * Secções "estruturadas" geridas por painéis dedicados no separador Candidatura
 * (TipologiasPanel, AtividadesPanel, InovacaoExtra/Cond, IntlAções/Detalhe,
 * Financeiro, Custos). Guardam dados em forma de tabela (campo `linhas` com um
 * array) e já têm um editor próprio acima — por isso **não** devem voltar a
 * aparecer na lista genérica do preview (senão duplicam e mostram JSON cru).
 * Fonte única para a API (`buildDTO`) e a Web.
 */
export const CAND_STRUCTURED_SECTIONS: ReadonlySet<string> = new Set([
  // Família A — Inovação Produtiva
  "tipologia",
  "atividades_inovacao",
  "indicadores",
  "industria_40",
  "transicao_climatica",
  "substituicao_importacoes",
  "descricao_fisica",
  "intake_inovacao",
  // Família B — Internacionalização
  "acoes_intl",
  "intl_acao_custos",
  "intl_deslocacoes",
  "intl_rh",
  "intake_intl",
  // Transversais
  "financeiro",
  "investimentos",
]);

/** Secção gerida por um painel dedicado (excluída da lista genérica do preview). */
export function isStructuredSection(key: string): boolean {
  return CAND_STRUCTURED_SECTIONS.has(key);
}

// ─── DTOs ─────────────────────────────────────────────────────────────────

export interface CandFieldDTO {
  id: string;
  section: string;
  key: string;
  value: unknown;
  origin: FieldOrigin;
  state: FieldState;
  sourceRef: string | null;
  updatedAt: string;
}

export interface CandSectionDTO {
  key: string;
  name: string;
  sgoRef: string | null;
  fields: CandFieldDTO[];
  /** progresso de validação: campos finais / total */
  total: number;
  finalised: number;
}

/** Estado do separador Candidatura (preview pré-preenchido). */
export interface CandidaturaDTO {
  id: string;
  projectId: string;
  family: CandFamily;
  familyLabel: string;
  stage: CandStage;
  codigoAviso: string | null;
  medida: string | null;
  codigoProjetoSgo: string | null;
  sections: CandSectionDTO[];
  /** resumo global de proveniência */
  summary: { total: number; finalised: number; pendingValidation: number };
}

/** Iniciar a candidatura (escolher a família). */
export interface StartCandidaturaRequest {
  family: CandFamily;
  codigoAviso?: string;
  medida?: string;
}

/** Atualizar/corrigir um campo no preview. */
export interface UpdateCandFieldRequest {
  section: string;
  key: string;
  value?: unknown;
  /** marcar como validado (sem alterar valor) ou corrigido (com novo valor) */
  action: "validar" | "corrigir";
}

/**
 * Adicionar um campo manual (intake) a uma secção genérica (TRNSF-1062).
 * O `label` torna-se a `key` do CandField (não há coluna `label` no modelo),
 * pelo que é simultaneamente o identificador e o rótulo legível do campo.
 */
export interface CreateManualFieldRequest {
  section: string;
  label: string;
  value?: unknown;
}

/**
 * Resultado da importação da identificação do beneficiário a partir do NIF da
 * empresa (TRNSF-1061). Reutiliza os adaptadores nif.pt + VIES do pré-diagnóstico.
 * Os campos importados entram como `api_empresas` / `por_validar` (o consultor
 * valida; nunca se inventam dados).
 *  - `ok`        — pelo menos um campo escrito, sem degradação relevante;
 *  - `parcial`   — escreveu-se algo, mas alguma faixa falhou (ex.: VIES deu nome,
 *                  API de empresas falhou);
 *  - `sem_chave` — API de empresas sem chave e nada pôde ser escrito;
 *  - `falhou`    — nenhuma faixa devolveu dados.
 */
export interface BeneficiarioImportDTO {
  estado: "ok" | "parcial" | "sem_chave" | "falhou";
  preenchidos: number;
  mensagem: string;
}
