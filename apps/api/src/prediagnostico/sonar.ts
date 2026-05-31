import type { FaixaEstado } from "@estrategor/shared";
import { env } from "../env.js";

export interface SonarResult {
  estado: FaixaEstado; // ok | falhou | sem_chave
  contexto: string | null;
  fontes: string[];
  bruto: unknown;
}

/**
 * Faixa C (recolha) — Perplexity Sonar (base). Recolhe contexto da empresa com
 * fontes (URLs). Sem chave → "sem_chave". Exige fontes; guarda as URLs.
 */
export async function consultarSonar(nif: string, nome: string | null): Promise<SonarResult> {
  if (!env.PERPLEXITY_API_KEY) return { estado: "sem_chave", contexto: null, fontes: [], bruto: null };
  try {
    const res = await fetch(`${env.PERPLEXITY_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "És um analista de pré-diagnóstico de empresas para candidaturas a fundos PT2030. " +
              "Recolhes contexto factual com fontes. Para cada afirmação relevante, cita pelo menos uma fonte. " +
              "Não afirmas situação fiscal, escalão PME nem rácios financeiros — esses confirmam-se oficialmente.",
          },
          {
            role: "user",
            content:
              `Empresa portuguesa com NIF ${nif}${nome ? ` (${nome})` : ""}. ` +
              "Resume: atividade real, mercados/geografias, presença digital (site/redes), notícias recentes, dimensão aparente e indícios de aderência a avisos PT2030. PT-PT, conciso.",
          },
        ],
      }),
    });
    if (!res.ok) return { estado: "falhou", contexto: null, fontes: [], bruto: { status: res.status } };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; citations?: string[] };
    return {
      estado: "ok",
      contexto: json.choices?.[0]?.message?.content?.trim() ?? null,
      fontes: Array.isArray(json.citations) ? json.citations : [],
      bruto: json,
    };
  } catch (e) {
    return { estado: "falhou", contexto: null, fontes: [], bruto: { erro: e instanceof Error ? e.message : String(e) } };
  }
}
