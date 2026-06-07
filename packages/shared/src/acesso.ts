/**
 * Pré-análise das Condições de acesso (TRNSF-1029).
 *
 * A partir dos dados já recolhidos no pré-diagnóstico (TRNSF-967), anexa a cada
 * condição de acesso uma SUGESTÃO e uma NOTA (evidência recolhida ou o que falta
 * confirmar). LINHA VERMELHA: nunca decide elegibilidade — não devolve PASSA/
 * FALHA; o estado da condição continua a ser do consultor. Usa apenas dados
 * recolhidos; não inventa valores nem regras.
 */
import type { AvisoElegibilidade, CondSugestao, GeoEmpresa } from "./dto.js";

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

export interface ResultadoAcesso {
  sugestao: CondSugestao;
  nota: string;
}

const tem = (v?: string | null): boolean => !!(v && String(v).trim());
const soDigitos = (v: string): string => v.replace(/[^0-9]/g, "");

/** O CAE da empresa está coberto pela lista do aviso? Aceita correspondência
 *  exata ou por prefixo (ex.: lista "74" cobre "74900"). */
function caeCoberto(caeEmpresa: string, lista: string[]): boolean {
  const c = soDigitos(caeEmpresa);
  if (!c) return false;
  return lista.some((e) => {
    const le = soDigitos(e);
    return le.length > 0 && (c === le || c.startsWith(le));
  });
}

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
    return { sugestao: "sem_dados", nota: "Calcula-se a partir da IES validada (componente financeira)." };
  }

  return null;
}

/**
 * Verificação determinística (TRNSF-1030): cruza os dados recolhidos com a
 * elegibilidade ESTRUTURADA e VALIDADA do aviso para devolver Provável PASSA/
 * FALHA nas condições de CAE/região/natureza. Sem elegibilidade validada ou
 * sem dados, recai na pré-análise textual (TRNSF-1029). Nunca decide: o
 * resultado é sempre "a confirmar".
 */
export function verificarCondicaoAcesso(
  label: string,
  d: DadosAcesso,
  elig: AvisoElegibilidade | null,
  geo: GeoEmpresa | null,
): ResultadoAcesso | null {
  const l = label.toLowerCase();
  const validada = !!elig && elig.estado === "validado";

  // CAE elegível — correspondência exata/por prefixo contra a lista do aviso
  if (/\bcae\b/.test(l) && validada && elig!.caeElegiveis.length && tem(d.cae)) {
    return caeCoberto(d.cae!, elig!.caeElegiveis)
      ? { sugestao: "provavel_passa", nota: `CAE recolhido (${d.cae}) consta da lista de CAE elegíveis do aviso. A confirmar na certidão permanente.` }
      : { sugestao: "provavel_falha", nota: `CAE recolhido (${d.cae}) não consta da lista de CAE elegíveis do aviso. Confirmar o CAE oficial.` };
  }

  // Localização / região / baixa densidade
  if (/(localiza|territ[óo]rio|regi[ãa]o|baixa densidade)/.test(l) && validada && geo) {
    if (/baixa densidade/.test(l) && elig!.exigeBaixaDensidade && geo.baixaDensidade !== null) {
      return geo.baixaDensidade
        ? { sugestao: "provavel_passa", nota: "O concelho da sede está classificado como território de baixa densidade. A confirmar." }
        : { sugestao: "provavel_falha", nota: "O concelho da sede não consta como baixa densidade (exigida pelo aviso). A confirmar." };
    }
    if (elig!.nuts2Elegiveis.length && tem(geo.nuts2)) {
      return elig!.nuts2Elegiveis.includes(geo.nuts2!)
        ? { sugestao: "provavel_passa", nota: `A região da sede (${geo.nuts2}) consta das regiões elegíveis do aviso. A confirmar.` }
        : { sugestao: "provavel_falha", nota: `A região da sede (${geo.nuts2}) não consta das regiões elegíveis do aviso. A confirmar.` };
    }
  }

  // Natureza jurídica elegível
  if (/(natureza\s+jur[íi]dica|forma\s+jur[íi]dica)/.test(l) && validada && elig!.naturezasElegiveis.length && tem(d.naturezaJuridica)) {
    const nj = d.naturezaJuridica!.toLowerCase();
    const ok = elig!.naturezasElegiveis.some((n) => nj.includes(n.toLowerCase()) || n.toLowerCase().includes(nj));
    return ok
      ? { sugestao: "provavel_passa", nota: `Natureza jurídica recolhida (${d.naturezaJuridica}) compatível com o aviso. A confirmar.` }
      : { sugestao: "provavel_falha", nota: `Natureza jurídica recolhida (${d.naturezaJuridica}) não consta das formas elegíveis do aviso. A confirmar.` };
  }

  // Sem cruzamento determinístico → pré-análise textual (indício/sem dados)
  return sugerirCondicaoAcesso(label, d);
}
