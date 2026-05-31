/**
 * Verificador + Cálculo de Mérito (TRNSF-946).
 *
 * Verifica a candidatura em três eixos — formulário, mérito e coerência interna
 * — e devolve não-conformidades acionáveis + o mérito previsto (MP) calculado
 * DETERMINISTICAMENTE a partir da grelha (TRNSF-941) e dos indicadores
 * (TRNSF-944). A IA propõe o texto; o cálculo do MP nunca é por IA.
 */

export type VerifEixo = "formulario" | "merito" | "coerencia";
export type VerifGravidade = "erro" | "aviso";

export interface NaoConformidade {
  eixo: VerifEixo;
  gravidade: VerifGravidade;
  mensagem: string;
  /** secção/campo da candidatura a que a não-conformidade liga (AC2) */
  seccao: string | null;
}

export interface MeritoCriterioDTO {
  codigo: string;
  nome: string;
  peso: number;
  score: number;
  belowMinimum: boolean;
}

export type VerifResultado = "conforme" | "nao_conforme" | "sem_grelha";

export interface VerificacaoDTO {
  resultado: VerifResultado;
  naoConformidades: NaoConformidade[];
  /** mérito previsto (determinístico, grelha TRNSF-941) */
  mpPrevisto: number | null;
  mpMinimo: number | null;
  atingeMinimo: boolean | null;
  mpPorCriterio: MeritoCriterioDTO[];
  /** data da última verificação (ISO), ou null se nunca correu */
  criadoEm: string | null;
}

export function resumoVerificacao(dto: VerificacaoDTO): string {
  const erros = dto.naoConformidades.filter((n) => n.gravidade === "erro").length;
  const avisos = dto.naoConformidades.filter((n) => n.gravidade === "aviso").length;
  return `${erros} não-conformidade(s), ${avisos} aviso(s)`;
}
