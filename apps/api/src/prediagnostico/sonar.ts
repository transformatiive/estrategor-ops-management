import type { FaixaEstado } from "@estrategor/shared";
import { env } from "../env.js";

export interface SonarResult {
  estado: FaixaEstado; // ok | falhou | sem_chave
  contexto: string | null;
  fontes: string[];
  bruto: unknown;
}

/** Extrai URLs de um texto (fallback quando não há `citations`). */
function urlsDe(texto: string): string[] {
  return [...new Set((texto.match(/https?:\/\/[^\s)\]]+/g) ?? []).map((u) => u.replace(/[.,]+$/, "")))];
}

/**
 * Faixa C (recolha) — Perplexity Sonar VIA OpenRouter (mesma chave já usada na
 * app; modelo OPENROUTER_MODEL_SONAR). Recolhe contexto da empresa com fontes.
 * Sem OPENROUTER_API_KEY → "sem_chave".
 */
export async function consultarSonar(nif: string, nome: string | null): Promise<SonarResult> {
  if (!env.OPENROUTER_API_KEY) return { estado: "sem_chave", contexto: null, fontes: [], bruto: null };
  try {
    const res = await fetch(`${env.OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Estrategor" },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL_SONAR,
        messages: [
          {
            role: "system",
            content:
              "És um analista de pré-diagnóstico de empresas para candidaturas a fundos PT2030. " +
              "Recolhes contexto factual com fontes. Para cada afirmação relevante, cita pelo menos uma fonte (URL). " +
              "Não afirmas situação fiscal, escalão PME nem rácios financeiros — esses confirmam-se oficialmente.",
          },
          {
            role: "user",
            content:
              `Empresa portuguesa com NIF ${nif}${nome ? ` (${nome})` : ""}. ` +
              "Resume: atividade real, mercados/geografias, presença digital (site/redes), notícias recentes, dimensão aparente e indícios de aderência a avisos PT2030. PT-PT, conciso, com URLs das fontes.",
          },
        ],
      }),
    });
    if (!res.ok) return { estado: "falhou", contexto: null, fontes: [], bruto: { status: res.status } };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; citations?: string[] };
    const contexto = json.choices?.[0]?.message?.content?.trim() ?? null;
    // OpenRouter passa as citações da Perplexity em `citations`; senão, extrai do texto
    const fontes = Array.isArray(json.citations) && json.citations.length ? json.citations : contexto ? urlsDe(contexto) : [];
    return { estado: "ok", contexto, fontes, bruto: json };
  } catch (e) {
    return { estado: "falhou", contexto: null, fontes: [], bruto: { erro: e instanceof Error ? e.message : String(e) } };
  }
}
