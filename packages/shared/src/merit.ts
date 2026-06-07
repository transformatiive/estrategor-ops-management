/**
 * Motor de mérito A0 (TRNSF-940) e tipos do esquema `GrelhaMerito` (TRNSF-941).
 *
 * Princípio: a grelha é DADOS, nunca código. O motor calcula a MP a partir da
 * grelha + das selecções do consultor por subcritério. Trocar uma grelha não
 * exige alterar este ficheiro. As grelhas reais são semeadas na BD (seed);
 * `QUALIFICACAO_MPR_2025_2` está aqui para o seed e os testes.
 */
import { z } from "zod";

/** Opção pontuável de um subcritério (o consultor escolhe uma). */
export interface MeritOption {
  /** etiqueta legível da condição (ex.: ">=75%") */
  label: string;
  /** pontuação atribuída (1..5, pode ter casas decimais) */
  pts: number;
  /** nota opcional (ex.: "determina não elegibilidade") */
  note?: string;
}

export interface MeritSubcriterion {
  codigo: string;
  nome: string;
  /** peso dentro do critério (quando há fórmula interna); default = igual */
  weight?: number;
  /** opções pontuáveis; quando há matriz regional, varia por região */
  options?: MeritOption[];
  /** matriz regional: região → opções */
  regionalOptions?: Record<string, MeritOption[]>;
}

export interface MeritCriterion {
  codigo: string; // A | B | C | D
  nome: string;
  peso: number; // peso na fórmula MP
  /** fórmula interna entre subcritérios, ex.: "0.50*B.1 + 0.15*B.2 + 0.35*B.3" */
  formula?: string;
  subcriterios: MeritSubcriterion[];
}

export interface MeritScale {
  min: number;
  max: number;
  descritores: Record<string, string>;
}

export interface MeritGridData {
  programa: string;
  medida: string;
  codigo_aviso: string;
  regiao: string | null;
  versao: string;
  fonte_url?: string;
  escala: MeritScale;
  mp_minimo: number;
  minimo_por_criterio: number;
  formula_mp: string; // ex.: "0.30*A + 0.30*B + 0.15*C + 0.25*D"
  desempate?: string[];
  criterios: MeritCriterion[];
}

/** Selecção do consultor: subcritério → índice da opção escolhida. */
export type MeritSelection = Record<string, number>;

export interface CriterionScore {
  codigo: string;
  nome: string;
  peso: number;
  score: number; // pontuação do critério (1..5)
  belowMinimum: boolean;
  subScores: { codigo: string; nome: string; score: number | null }[];
}

export interface MeritResult {
  mp: number; // pontuação final ponderada
  criteria: CriterionScore[];
  meetsMpMinimo: boolean;
  meetsAllCriteria: boolean;
  /** true quando atinge o MP mínimo E o mínimo por critério */
  passes: boolean;
  /** subcritérios ainda sem selecção (cálculo parcial) */
  missing: string[];
}

/** Extrai os pesos de uma fórmula tipo "0.50*B.1 + 0.15*B.2" → {B.1:0.5,...}. */
function parseFormulaWeights(formula: string): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const term of formula.split("+")) {
    const m = term.trim().match(/^([0-9]*\.?[0-9]+)\s*\*\s*([A-Za-z0-9.]+)$/);
    if (m) weights[m[2]!] = parseFloat(m[1]!);
  }
  return weights;
}

/** Lista das regiões disponíveis numa grelha (união das matrizes regionais). */
export function gridRegions(grid: MeritGridData): string[] {
  const set = new Set<string>();
  for (const c of grid.criterios) {
    for (const s of c.subcriterios) {
      if (s.regionalOptions)
        Object.keys(s.regionalOptions).forEach((r) => set.add(r));
    }
  }
  return [...set];
}

/** Normaliza para comparação acento-insensível e minúsculas. */
function normRegiao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Aliases conhecidos NUTS II → chave RIS3 da grelha (quando diferem).
 * Ex.: o NUTS II canónico é "Área Metropolitana de Lisboa" mas a matriz
 * regional A.1 usa a chave "Lisboa". As chaves estão normalizadas.
 */
const NUTS2_PARA_GRELHA_ALIAS: Record<string, string> = {
  [normRegiao("Área Metropolitana de Lisboa")]: "Lisboa",
  [normRegiao("Lisboa")]: "Lisboa",
};

/**
 * Mapeia o NUTS II (canónico) da empresa para a chave da matriz regional da
 * grelha que lhe corresponde, ou null se nenhuma corresponde.
 *
 * Regras (TRNSF-1042): a região do investimento é uma SUGESTÃO que o consultor
 * confirma. Esta função NUNCA inventa uma região que não esteja em
 * `regioesGrelha` — só devolve um valor efetivamente presente na grelha.
 *  (a) correspondência exata (acento/caixa-insensível) com `regioesGrelha`;
 *  (b) alias conhecido RIS3↔NUTS II (ex.: AML → "Lisboa"), validado contra a grelha;
 *  (c) caso contrário, null.
 */
export function regiaoGrelhaParaNuts2(
  nuts2: string | null | undefined,
  regioesGrelha: string[],
): string | null {
  if (!nuts2?.trim() || regioesGrelha.length === 0) return null;
  const alvo = normRegiao(nuts2);
  // (a) correspondência exata com uma chave da grelha
  const exata = regioesGrelha.find((r) => normRegiao(r) === alvo);
  if (exata) return exata;
  // (b) alias conhecido → só vale se essa chave existir na grelha
  const aliasKey = NUTS2_PARA_GRELHA_ALIAS[alvo];
  if (aliasKey) {
    const naGrelha = regioesGrelha.find((r) => normRegiao(r) === normRegiao(aliasKey));
    if (naGrelha) return naGrelha;
  }
  // (c) sem correspondência → null (nunca inventa região fora da grelha)
  return null;
}

/** true se a grelha tem subcritérios que variam por região (matriz regional). */
export function gridHasRegionalMatrix(grid: MeritGridData): boolean {
  return grid.criterios.some((c) =>
    c.subcriterios.some((s) => Boolean(s.regionalOptions)),
  );
}

function optionsFor(
  sub: MeritSubcriterion,
  regiao: string | null,
): MeritOption[] | undefined {
  if (sub.regionalOptions) {
    if (regiao && sub.regionalOptions[regiao])
      return sub.regionalOptions[regiao];
    return undefined; // matriz regional mas região não definida → sem opções
  }
  return sub.options;
}

/**
 * Calcula a MP a partir da grelha e das selecções do consultor.
 * - Pontuação de cada critério: média ponderada dos subcritérios (pela fórmula
 *   interna se existir, senão média simples).
 * - MP final: soma de peso_critério * score_critério.
 * - `passes` exige MP >= mp_minimo e cada critério >= minimo_por_criterio.
 */
export function computeMerit(
  grid: MeritGridData,
  selection: MeritSelection,
  regiao?: string | null,
): MeritResult {
  // a região efetiva resolve a matriz regional (A.1): override do diagnóstico,
  // ou a da própria grelha quando fixa.
  const effectiveRegion = regiao ?? grid.regiao;
  const missing: string[] = [];
  const criteria: CriterionScore[] = grid.criterios.map((crit) => {
    const fweights = crit.formula ? parseFormulaWeights(crit.formula) : null;
    const subScores = crit.subcriterios.map((sub) => {
      const opts = optionsFor(sub, effectiveRegion);
      const idx = selection[sub.codigo];
      let score: number | null = null;
      if (opts && idx !== undefined && idx >= 0 && idx < opts.length) {
        score = opts[idx]!.pts;
      } else {
        missing.push(sub.codigo);
      }
      return { codigo: sub.codigo, nome: sub.nome, score };
    });

    // pontuação do critério: ponderada pela fórmula interna, ou média simples
    let critScore = 0;
    let wsum = 0;
    for (const ss of subScores) {
      const w = fweights?.[ss.codigo] ?? 1 / crit.subcriterios.length;
      if (ss.score !== null) {
        critScore += w * ss.score;
        wsum += w;
      }
    }
    const normalized = wsum > 0 ? critScore / wsum : 0;
    return {
      codigo: crit.codigo,
      nome: crit.nome,
      peso: crit.peso,
      score: round2(normalized),
      belowMinimum: wsum > 0 && normalized < grid.minimo_por_criterio,
      subScores,
    };
  });

  const mpWeights = parseFormulaWeights(grid.formula_mp);
  let mp = 0;
  for (const c of criteria) {
    const w = mpWeights[c.codigo] ?? c.peso;
    mp += w * c.score;
  }
  mp = round2(mp);

  const complete = missing.length === 0;
  const meetsMpMinimo = mp >= grid.mp_minimo;
  const meetsAllCriteria = criteria.every(
    (c) => c.score >= grid.minimo_por_criterio,
  );
  return {
    mp,
    criteria,
    meetsMpMinimo,
    meetsAllCriteria,
    passes: complete && meetsMpMinimo && meetsAllCriteria,
    missing,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Condições de acesso (§7.1) — DADOS por aviso ────────────────────────────
export interface AccessCondition {
  key: string;
  label: string;
}

/** Condições de acesso do SI Inovação Produtiva — MPr-2025-9 (§7.1). */
export const ACCESS_CONDITIONS_MPR_2025_9: AccessCondition[] = [
  { key: "pme_contab_organizada", label: "PME com contabilidade organizada" },
  {
    key: "autonomia_financeira",
    label: "Autonomia financeira (Anexo III REITD, ano 2024)",
  },
  {
    key: "capitais_proprios_25",
    label: "≥ 25% dos capitais próprios até ao 1.º pagamento",
  },
  {
    key: "ii_10",
    label: "Indicador de Impacto do Investimento II ≥ 10% (PITD/Norte/Centro)",
  },
  { key: "dnsh", label: "Princípio DNSH (não prejudicar significativamente)" },
  {
    key: "tipologia_acao",
    label:
      "Tipologia de ação válida (novo estabelecimento / aumento ≥ 20% / diversificação ≥ 200% / alteração fundamental de processo)",
  },
  {
    key: "localizacao",
    label:
      "Localização: estabelecimento do investimento; território de baixa densidade",
  },
  { key: "duracao_24m", label: "Duração da operação: 24 meses" },
  {
    key: "regularizada_at_ss",
    label:
      "Situação regularizada AT e Segurança Social; sem duplo financiamento",
  },
];

// ─── SEMENTE 1 (real, completa) — SICE Qualificação das PME · MPr-2025-2 ──────
export const QUALIFICACAO_MPR_2025_2: MeritGridData = {
  programa: "PT2030",
  medida: "SICE - Qualificacao das PME - Operacoes em Conjunto",
  codigo_aviso: "MPr-2025-2",
  regiao: null,
  versao: "2025-03-10",
  fonte_url:
    "https://portugal2030.pt/wp-content/uploads/sites/3/2025/03/Aviso-SICE-Qualificacao-Proj-Conjuntos_V-Publicacao10.03.2025.pdf",
  escala: {
    min: 1,
    max: 5,
    descritores: {
      "1": "Muito insuficiente",
      "2": "Insuficiente",
      "3": "Suficiente",
      "4": "Bom",
      "5": "Muito bom",
    },
  },
  mp_minimo: 3.0,
  minimo_por_criterio: 3.0,
  formula_mp: "0.30*A + 0.30*B + 0.15*C + 0.25*D",
  desempate: ["B", "data_entrada"],
  criterios: [
    {
      codigo: "A",
      nome: "Adequação à Estratégia",
      peso: 0.3,
      subcriterios: [
        {
          codigo: "A.1",
          nome: "Nível de enquadramento na RIS3 Regional",
          regionalOptions: {
            Centro: [
              { label: "Não alinhada com nenhuma Linha de Ação", pts: 3 },
              { label: "≥ 1 Linha de Ação", pts: 5 },
            ],
            Lisboa: [
              { label: "Não se enquadra", pts: 1 },
              { label: "≥ 1 Domínio Temático OU 1 Transversal", pts: 3 },
              {
                label: "≥ 1 Temático + 1-2 Transversal OU 2 Transversal",
                pts: 4,
              },
              { label: "Projeto/Programa Estruturante", pts: 5 },
            ],
            Alentejo: [
              { label: "Sem enquadramento EREI 2030", pts: 2 },
              { label: "1 domínio", pts: 3 },
              { label: "> 1 domínio", pts: 4 },
            ],
            Norte: [
              { label: "Sem enquadramento S3 Norte 2027", pts: 1 },
              { label: "Enquadrado num domínio S3 Norte 2027", pts: 3 },
              {
                label: "Enquadramento setorial forte no racional do domínio",
                pts: 5,
              },
            ],
          },
        },
      ],
    },
    {
      codigo: "B",
      nome: "Qualidade",
      peso: 0.3,
      formula: "0.50*B.1 + 0.15*B.2 + 0.35*B.3",
      subcriterios: [
        {
          codigo: "B.1",
          nome: "Coerência/adequação do plano de ação conjunto",
          options: [
            { label: "Muito bom", pts: 5 },
            { label: "Suficiente", pts: 3 },
            {
              label: "Muito insuficiente",
              pts: 1,
              note: "determina não elegibilidade",
            },
          ],
        },
        {
          codigo: "B.2",
          nome: "Grau de adesão (PME com pré-adesão / total %)",
          options: [
            { label: "≥ 75%", pts: 5 },
            { label: "60-75%", pts: 4 },
            { label: "55-60%", pts: 3 },
            { label: "50-55%", pts: 2 },
            { label: "< 50%", pts: 1 },
          ],
        },
        {
          codigo: "B.3",
          nome: "Carácter inovador",
          options: [
            { label: "Fatores a) + b)", pts: 4 },
            { label: "Fator a)", pts: 3 },
            { label: "Fator b)", pts: 2 },
            { label: "Nenhum", pts: 1 },
          ],
        },
      ],
    },
    {
      codigo: "C",
      nome: "Capacidade de Execução",
      peso: 0.15,
      subcriterios: [
        {
          codigo: "C.1",
          nome: "Capacidade de gestão e implementação",
          options: [
            { label: "Todos os fatores", pts: 5 },
            { label: "3 fatores", pts: 4 },
            { label: "2 fatores", pts: 3 },
            { label: "Nenhum / 1 fator", pts: 1 },
          ],
        },
      ],
    },
    {
      codigo: "D",
      nome: "Impacto",
      peso: 0.25,
      formula: "0.70*D.1 + 0.30*D.2",
      subcriterios: [
        {
          codigo: "D.1",
          nome: "Impacto na competitividade (domínios imateriais)",
          options: [
            { label: "Apenas Outros domínios", pts: 3 },
            { label: "Outros + 1 de (B/C/D)", pts: 4 },
            { label: "Outros + 2", pts: 4.5 },
            { label: "Outros + 3", pts: 5 },
            { label: "Só 2 de (B/C/D)", pts: 4.5 },
            { label: "Só 3 de (B/C/D)", pts: 5 },
          ],
        },
        {
          codigo: "D.2",
          nome: "Impacto na economia (demonstração/benchmarking)",
          options: [
            { label: "2 fatores", pts: 5 },
            { label: "1 fator", pts: 3 },
            { label: "Nenhum", pts: 1 },
          ],
        },
      ],
    },
  ],
};

// ─── Validação Zod da grelha (TRNSF-1038) ────────────────────────────────────
// Permite à API (e ao editor) validar uma grelha completa antes de a persistir.
// O catálogo de avisos cria/edita grelhas do zero ou a partir da proposta da IA;
// estes esquemas garantem que os DADOS estão coerentes (pesos finitos, códigos
// não vazios, ao menos 1 critério/subcritério, opções ou matriz regional, etc).

const numeroFinito = z
  .number({ invalid_type_error: "Tem de ser um número." })
  .refine((n) => Number.isFinite(n), "Tem de ser um número finito.");

/** Padrão simples de fórmula "w*CODE + w*CODE + …" (igual ao parseFormulaWeights). */
const FORMULA_RE =
  /^\s*[0-9]*\.?[0-9]+\s*\*\s*[A-Za-z0-9.]+(\s*\+\s*[0-9]*\.?[0-9]+\s*\*\s*[A-Za-z0-9.]+)*\s*$/;
const formulaSchema = z
  .string()
  .trim()
  .min(1, "Fórmula vazia.")
  .regex(FORMULA_RE, 'Fórmula inválida — use o formato "0.30*A + 0.30*B".');

export const meritOptionSchema: z.ZodType<MeritOption> = z.object({
  label: z.string().trim().min(1, "Etiqueta da opção vazia."),
  pts: numeroFinito,
  note: z.string().optional(),
});

export const meritSubcriterionSchema: z.ZodType<MeritSubcriterion> = z
  .object({
    codigo: z.string().trim().min(1, "Código do subcritério vazio."),
    nome: z.string().trim().min(1, "Nome do subcritério vazio."),
    weight: numeroFinito.optional(),
    options: z
      .array(meritOptionSchema)
      .min(1, "Subcritério sem opções.")
      .optional(),
    regionalOptions: z
      .record(
        z.string(),
        z.array(meritOptionSchema).min(1, "Região sem opções."),
      )
      .optional(),
  })
  .superRefine((s, ctx) => {
    const temOptions = Array.isArray(s.options) && s.options.length > 0;
    const regioes = s.regionalOptions ? Object.keys(s.regionalOptions) : [];
    const temRegional = regioes.length > 0;
    if (!temOptions && !temRegional) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Subcritério ${s.codigo}: defina opções ou uma matriz regional (≥1 região com ≥1 opção).`,
      });
    }
  });

export const meritCriterionSchema: z.ZodType<MeritCriterion> = z.object({
  codigo: z.string().trim().min(1, "Código do critério vazio."),
  nome: z.string().trim().min(1, "Nome do critério vazio."),
  peso: numeroFinito,
  formula: formulaSchema.optional(),
  subcriterios: z
    .array(meritSubcriterionSchema)
    .min(1, "Critério sem subcritérios."),
});

export const meritScaleSchema: z.ZodType<MeritScale> = z.object({
  min: numeroFinito,
  max: numeroFinito,
  descritores: z.record(z.string(), z.string()),
});

export const meritGridDataSchema: z.ZodType<MeritGridData> = z.object({
  programa: z.string().trim().min(1, "Programa vazio."),
  medida: z.string().trim().min(1, "Medida vazia."),
  codigo_aviso: z.string().trim().min(1, "Código do aviso vazio."),
  regiao: z.string().nullable(),
  versao: z.string().trim().min(1, "Versão vazia."),
  fonte_url: z.string().optional(),
  escala: meritScaleSchema,
  mp_minimo: numeroFinito,
  minimo_por_criterio: numeroFinito,
  formula_mp: formulaSchema,
  desempate: z.array(z.string()).optional(),
  criterios: z
    .array(meritCriterionSchema)
    .min(1, "A grelha tem de ter ≥1 critério."),
});

export const accessConditionSchema: z.ZodType<AccessCondition> = z.object({
  key: z.string().trim().min(1, "Chave da condição vazia."),
  label: z.string().trim().min(1, "Etiqueta da condição vazia."),
});

/** Resultado da validação da grelha (sem exceções). */
export type ParseGridResult =
  | { ok: true; data: MeritGridData }
  | { ok: false; error: string };

/**
 * Valida (e devolve) uma grelha completa. Não lança: devolve `{ok:false,error}`
 * com a 1.ª mensagem de erro legível, para o editor/admin corrigir.
 */
export function parseMeritGrid(input: unknown): ParseGridResult {
  const r = meritGridDataSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const issue = r.error.issues[0];
  const caminho = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
  return {
    ok: false,
    error: `${caminho}${issue?.message ?? "Grelha inválida."}`,
  };
}

// ─── DTOs do catálogo de avisos (TRNSF-1038) ─────────────────────────────────

/** Linha da lista de avisos no painel admin. */
export interface AvisoAdminListItemDTO {
  id: string;
  programCode: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string | null;
  /** true = publicado (visível aos consultores); false = rascunho. */
  extracted: boolean;
  mpMinimo: number | null;
  nCriterios: number;
  nCondicoes: number;
  /** estado da elegibilidade estruturada: "validado" | "por_validar" | "nenhuma". */
  eligibilidadeEstado: "validado" | "por_validar" | "nenhuma";
  updatedAt: string | null;
}

/** Aviso completo (metadados + grelha + condições + elegibilidade) para o editor. */
export interface AvisoFullDTO {
  id: string;
  programCode: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string | null;
  mpMinimo: number | null;
  minimoPorCriterio: number | null;
  formulaMp: string | null;
  grid: MeritGridData;
  accessConditions: AccessCondition[];
  eligibilidade: AvisoElegibilidadeLike | null;
  extracted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Forma da elegibilidade estruturada do aviso (espelha AvisoElegibilidade do dto). */
export interface AvisoElegibilidadeLike {
  caeElegiveis: string[];
  nuts2Elegiveis: string[];
  exigeBaixaDensidade: boolean;
  naturezasElegiveis: string[];
  estado: "por_validar" | "validado";
  notas?: string | null;
  fonteUrl?: string | null;
}
