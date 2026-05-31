/**
 * Inovação Produtiva — secções condicionais (TRNSF-958):
 *  - Substituição de Importações (A.7): por produto/mercado, valor importado
 *    atual vs. produção nacional pretendida (demonstra o efeito de substituição);
 *    liga-se às linhas de mercado (cand_mercado_linhas, TRNSF-942).
 *  - Descrição Física (A.15): caracterização física do investimento (instalações,
 *    área, tipologia construtiva) — relevante p.ex. para Turismo.
 */

export interface SubstituicaoLinha {
  id: string;
  produto: string;
  mercadoPais: string | null;
  valorImportado: number | null;
  producaoNacionalPrevista: number | null;
}

export interface DescricaoFisicaDados {
  instalacoes: string | null;
  areaM2: number | null;
  tipologiaConstrutiva: string | null;
  notas: string | null;
}

export function emptyDescricaoFisica(): DescricaoFisicaDados {
  return { instalacoes: null, areaM2: null, tipologiaConstrutiva: null, notas: null };
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface InovacaoCondDTO {
  substituicao: SubstituicaoLinha[];
  descricaoFisica: DescricaoFisicaDados;
}

export interface NovaSubstituicaoLinha {
  produto: string;
  mercadoPais?: string | null;
  valorImportado?: number | null;
  producaoNacionalPrevista?: number | null;
}
