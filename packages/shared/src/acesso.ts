/**
 * Pré-análise das Condições de acesso (TRNSF-1029).
 *
 * A partir dos dados já recolhidos no pré-diagnóstico (TRNSF-967), anexa a cada
 * condição de acesso uma SUGESTÃO e uma NOTA (evidência recolhida ou o que falta
 * confirmar). LINHA VERMELHA: nunca decide elegibilidade — não devolve PASSA/
 * FALHA; o estado da condição continua a ser do consultor. Usa apenas dados
 * recolhidos; não inventa valores nem regras.
 */
import type { CondSugestao } from "./dto.js";

/** Dados recolhidos relevantes para as condições de acesso. */
export interface DadosAcesso {
  cae?: string | null; // ex.: "74900 — Consultoria…"
  concelho?: string | null;
  distrito?: string | null;
  naturezaJuridica?: string | null;
  setor?: string | null; // leitura da IA (atividade aparente)
}

export interface SugestaoAcesso {
  sugestao: CondSugestao;
  nota: string;
}

const tem = (v?: string | null): boolean => !!(v && String(v).trim());

/**
 * Devolve a sugestão para uma condição (pelo seu rótulo), ou null quando não há
 * dados relevantes (a condição fica manual, sem sugestão).
 */
export function sugerirCondicaoAcesso(label: string, d: DadosAcesso): SugestaoAcesso | null {
  const l = label.toLowerCase();

  // Localização / território / região / baixa densidade
  if (/(localiza|territ[óo]rio|regi[ãa]o|baixa densidade)/.test(l)) {
    if (tem(d.concelho) || tem(d.distrito)) {
      const loc = [d.concelho, d.distrito].filter((x) => tem(x)).join(", ");
      return { sugestao: "indicio", nota: `Sede recolhida: ${loc}. Confirmar o enquadramento territorial (ex.: baixa densidade / NUTS) na lista oficial do aviso.` };
    }
    return { sugestao: "sem_dados", nota: "Localização não recolhida — confirmar a sede do estabelecimento do investimento." };
  }

  // CAE
  if (/\bcae\b/.test(l)) {
    if (tem(d.cae)) return { sugestao: "indicio", nota: `CAE recolhido: ${d.cae}. Confirmar se consta da lista de CAE elegíveis do aviso (certidão permanente).` };
    return { sugestao: "sem_dados", nota: "CAE não recolhido — confirmar na certidão permanente." };
  }

  // Dimensão / escalão PME (linha vermelha — só indício, confirma-se oficialmente)
  if (/\bpme\b|dimens[ãa]o|micro|pequena|m[ée]dia empresa/.test(l)) {
    return {
      sugestao: "sem_dados",
      nota: tem(d.setor)
        ? `Indício pela atividade recolhida (${d.setor}). O escalão PME confirma-se oficialmente (Declaração PME / IAPMEI).`
        : "O escalão PME confirma-se oficialmente (Declaração PME / IAPMEI).",
    };
  }

  // Situação fiscal / contributiva
  if (/(regulariza|tribut[áa]ri|seguran[çc]a social|\bat\b)/.test(l)) {
    return { sugestao: "sem_dados", nota: "Requer certidões da AT e da Segurança Social (não recolhido automaticamente)." };
  }

  // Autonomia financeira / capitais próprios / rácios
  if (/(autonomia financeira|capitais\s+pr[óo]prios|capital\s+pr[óo]prio|r[áa]cio)/.test(l)) {
    return { sugestao: "sem_dados", nota: "Calcula-se a partir da IES validada (componente financeira — TRNSF-944)." };
  }

  return null;
}
