import type { ChecklistAConfirmar, FaixaEstado } from "@estrategor/shared";
import { env } from "../env.js";

export interface SonnetLeitura {
  setor: string | null;
  caeProvavel: string | null;
  tipologiaAviso: string | null;
  sinais: string | null;
}

export interface SonnetResult {
  estado: FaixaEstado; // ok | falhou | sem_chave
  leitura: SonnetLeitura;
  checklistExtra: ChecklistAConfirmar[];
  bruto: unknown;
}

const LEITURA_VAZIA: SonnetLeitura = { setor: null, caeProvavel: null, tipologiaAviso: null, sinais: null };

/**
 * Faixa C (juízo) — Claude Sonnet 4.6 (via OpenRouter). Estrutura as faixas
 * A+B+C numa leitura (setor, CAE provável, tipologia de aviso, sinais) e numa
 * checklist "a confirmar oficialmente". NUNCA produz elegibilidade como facto.
 */
export async function estruturarSonnet(input: {
  nif: string;
  nome: string | null;
  caeApi: string | null;
  caeDescricao: string | null;
  contextoSonar: string | null;
}): Promise<SonnetResult> {
  if (!env.OPENROUTER_API_KEY) return { estado: "sem_chave", leitura: LEITURA_VAZIA, checklistExtra: [], bruto: null };
  try {
    const system =
      "És um analista sénior de pré-diagnóstico PT2030 da Transformatiive. A partir dos dados fornecidos " +
      "(oficiais VIES, comerciais e contexto), produzes uma LEITURA estruturada e uma CHECKLIST do que tem de ser " +
      "confirmado oficialmente. REGRA DURA: nunca afirmes elegibilidade, escalão PME, situação fiscal/SS nem rácios " +
      "como facto — esses vão só para a checklist. Respondes só com JSON.";
    const user =
      `Dados:\n- NIF: ${input.nif}\n- Nome: ${input.nome ?? "—"}\n- CAE (API): ${input.caeApi ?? "—"} ${input.caeDescricao ?? ""}\n- Contexto: ${input.contextoSonar ?? "—"}\n\n` +
      'Devolve JSON: {"setor": string|null, "cae_provavel": string|null, "tipologia_aviso": string|null, "sinais": string|null, ' +
      '"checklist_a_confirmar": [{"item": string, "nota": string|null}]}';
    const res = await fetch(`${env.OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Estrategor" },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) return { estado: "falhou", leitura: LEITURA_VAZIA, checklistExtra: [], bruto: { status: res.status } };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return { estado: "falhou", leitura: LEITURA_VAZIA, checklistExtra: [], bruto: json };
    // alguns modelos devolvem o JSON dentro de ```json … ``` — remover a cerca
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as { setor?: string; cae_provavel?: string; tipologia_aviso?: string; sinais?: string; checklist_a_confirmar?: { item?: string; nota?: string | null }[] };
    return {
      estado: "ok",
      leitura: {
        setor: parsed.setor ?? null,
        caeProvavel: parsed.cae_provavel ?? null,
        tipologiaAviso: parsed.tipologia_aviso ?? null,
        sinais: parsed.sinais ?? null,
      },
      checklistExtra: (parsed.checklist_a_confirmar ?? []).filter((c) => c.item).map((c) => ({ item: String(c.item), nota: c.nota ?? null })),
      bruto: parsed,
    };
  } catch (e) {
    return { estado: "falhou", leitura: LEITURA_VAZIA, checklistExtra: [], bruto: { erro: e instanceof Error ? e.message : String(e) } };
  }
}
