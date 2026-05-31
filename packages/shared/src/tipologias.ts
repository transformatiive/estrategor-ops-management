/**
 * Inovação Produtiva — Tipologias de investimento (TRNSF-955, secção A.10).
 *
 * Uma ou mais tipologias por candidatura, cada uma com a sua sub-tabela de
 * dados. Os limiares regulamentares (≥ 20% de aumento de capacidade; investimento
 * ≥ 200% do valor dos ativos reutilizados na diversificação) são validados em
 * código contra os dados e assinalados — nunca silenciados. A fundamentação é
 * texto gerado (TRNSF-943, doc_type tipologia_fundamentacao).
 */

export const TIPOLOGIAS = ["novo_estab", "aumento_capacidade", "diversificacao", "alteracao_processo"] as const;
export type TipologiaTipo = (typeof TIPOLOGIAS)[number];

export const TIPOLOGIA_LABELS: Record<TipologiaTipo, string> = {
  novo_estab: "Criação de novo estabelecimento",
  aumento_capacidade: "Aumento da capacidade de estabelecimento existente",
  diversificacao: "Diversificação da produção para produtos novos",
  alteracao_processo: "Alteração fundamental do processo de produção",
};

export interface TipologiaCampoDef {
  key: string;
  label: string;
  tipo: "texto" | "numero";
}

/** Sub-tabela (campos de dados) condicional por tipologia. */
export const TIPOLOGIA_CAMPOS: Record<TipologiaTipo, TipologiaCampoDef[]> = {
  novo_estab: [{ key: "estabelecimento", label: "Estabelecimento", tipo: "texto" }],
  aumento_capacidade: [
    { key: "capacidade_pre", label: "Capacidade antes (un./ano)", tipo: "numero" },
    { key: "capacidade_pos", label: "Capacidade depois (un./ano)", tipo: "numero" },
  ],
  diversificacao: [
    { key: "valor_ativos_reutilizados", label: "Valor contabilístico dos ativos reutilizados (€)", tipo: "numero" },
    { key: "valor_investimento", label: "Investimento na diversificação (€)", tipo: "numero" },
  ],
  alteracao_processo: [{ key: "descricao_processo", label: "Processo alterado", tipo: "texto" }],
};

export interface TipologiaLinha {
  id: string;
  tipo: TipologiaTipo;
  dados: Record<string, string | number | null>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Valida os limiares regulamentares de uma linha; devolve mensagens (vazio = ok). */
export function validarLimiares(linha: TipologiaLinha): string[] {
  const msgs: string[] = [];
  if (linha.tipo === "aumento_capacidade") {
    const pre = num(linha.dados.capacidade_pre);
    const pos = num(linha.dados.capacidade_pos);
    if (pre != null && pos != null && pre > 0) {
      const pct = ((pos - pre) / pre) * 100;
      if (pct < 20) msgs.push(`Aumento de capacidade de ${pct.toFixed(1)}% — abaixo do limiar de 20%.`);
    } else {
      msgs.push("Indique a capacidade antes e depois para validar o limiar de 20%.");
    }
  }
  if (linha.tipo === "diversificacao") {
    const ativos = num(linha.dados.valor_ativos_reutilizados);
    const inv = num(linha.dados.valor_investimento);
    if (ativos != null && inv != null && ativos > 0) {
      if (inv < 2 * ativos) msgs.push(`Investimento (${inv}) inferior a 200% do valor dos ativos reutilizados (${ativos}).`);
    } else {
      msgs.push("Indique o valor dos ativos reutilizados e o investimento para validar o limiar de 200%.");
    }
  }
  return msgs;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

export interface TipologiaIssueDTO {
  id: string;
  tipo: TipologiaTipo;
  mensagem: string;
}

export interface TipologiasDTO {
  linhas: TipologiaLinha[];
  disponiveis: { tipo: TipologiaTipo; label: string; campos: TipologiaCampoDef[] }[];
  issues: TipologiaIssueDTO[];
}

export interface NovaTipologiaLinha {
  tipo: TipologiaTipo;
  dados?: Record<string, string | number | null>;
}
