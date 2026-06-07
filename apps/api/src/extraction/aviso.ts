import { NUTS, type AvisoElegibilidade } from "@estrategor/shared";
import { env } from "../env.js";
import { extractPdfText, looksLikePdf } from "../ai/pdf.js";

/**
 * Extração da ELEGIBILIDADE de um aviso a partir do seu PDF (TRNSF-1032, Fase 2B).
 * Descarrega o PDF do `fonteUrl`, lê o texto e pede à IA para PROPOR as regras
 * (CAE, regiões NUTS II, baixa densidade, naturezas). A proposta entra sempre
 * como `por_validar` — a IA propõe a partir da fonte real, o humano valida.
 * Nunca inventa: sem evidência, devolve listas vazias.
 */
export interface PropostaElegibilidade {
  proposta: AvisoElegibilidade;
  nota: string;
}

const NUTS2 = NUTS.map((n) => n.nuts2);

function rascunho(nota: string, dados?: Partial<AvisoElegibilidade>): PropostaElegibilidade {
  return {
    nota,
    proposta: {
      caeElegiveis: dados?.caeElegiveis ?? [],
      nuts2Elegiveis: dados?.nuts2Elegiveis ?? [],
      exigeBaixaDensidade: dados?.exigeBaixaDensidade ?? false,
      naturezasElegiveis: dados?.naturezasElegiveis ?? [],
      estado: "por_validar",
      notas: nota,
    },
  };
}

export async function extrairElegibilidadeDoAviso(url: string): Promise<PropostaElegibilidade> {
  if (!/^https?:\/\//i.test(url)) return rascunho("URL do aviso inválido.");
  if (!env.OPENROUTER_API_KEY) return rascunho("Extração IA indisponível (sem chave) — preencher manualmente.");

  let buffer: Buffer;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) return rascunho(`Não foi possível descarregar o PDF (HTTP ${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch {
    return rascunho("Falha ao descarregar o PDF do aviso.");
  }

  if (!looksLikePdf(buffer)) return rascunho("O URL não aponta para um PDF legível.");
  const texto = await extractPdfText(buffer, 24000);
  if (!texto) return rascunho("Não foi possível ler texto do PDF (pode estar digitalizado).");

  try {
    return await chamarIA(texto);
  } catch {
    return rascunho("Falha na extração por IA — preencher manualmente.");
  }
}

/** Mapeia uma região devolvida pela IA para o nome canónico NUTS II (ou null). */
export function normalizarNuts2(r: string): string | null {
  const x = r.trim().toLowerCase();
  if (!x) return null;
  return (
    NUTS2.find((n) => n.toLowerCase() === x) ??
    NUTS2.find((n) => n.toLowerCase().includes(x) || x.includes(n.toLowerCase())) ??
    null
  );
}

async function chamarIA(texto: string): Promise<PropostaElegibilidade> {
  const system =
    "És um analista de avisos de candidaturas a fundos (PT2030). Lês o texto do aviso e " +
    "extrais APENAS as regras de elegibilidade. Respondes só com JSON. Não inventas: se " +
    "não encontrares uma regra, devolves lista vazia ou false.";

  const instruction =
    "Do texto do aviso, extrai as regras de elegibilidade das empresas:\n" +
    '- caeElegiveis: códigos CAE elegíveis (ex.: "26110"). Se o aviso indicar divisões/' +
    'prefixos (ex.: "CAE da divisão 62"), inclui o prefixo (ex.: "62"). Vazio se não restringir.\n' +
    `- nuts2Elegiveis: regiões NUTS II elegíveis, usando EXATAMENTE estes nomes: ${NUTS2.join(", ")}. ` +
    "Vazio se for todo o território nacional.\n" +
    "- exigeBaixaDensidade: true só se o aviso restringir a territórios de baixa densidade.\n" +
    '- naturezasElegiveis: formas jurídicas elegíveis (ex.: "LDA", "SA"), se especificado.\n' +
    "- nota: 1 frase com a base (ex.: secção/anexo onde constam os CAE).\n\n" +
    "Formato JSON exato:\n" +
    '{"caeElegiveis": string[], "nuts2Elegiveis": string[], "exigeBaixaDensidade": boolean, ' +
    '"naturezasElegiveis": string[], "nota": string}\n\n' +
    "Texto do aviso:\n" +
    texto;

  const res = await fetch(`${env.OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Estrategor",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: instruction },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  const p = JSON.parse(raw) as {
    caeElegiveis?: unknown;
    nuts2Elegiveis?: unknown;
    exigeBaixaDensidade?: unknown;
    naturezasElegiveis?: unknown;
    nota?: unknown;
  };

  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const nuts = lista(p.nuts2Elegiveis)
    .map(normalizarNuts2)
    .filter((n): n is string => !!n);
  const nota = typeof p.nota === "string" && p.nota.trim() ? p.nota.trim() : "Proposta extraída do PDF do aviso — rever e validar.";

  return {
    nota,
    proposta: {
      caeElegiveis: lista(p.caeElegiveis),
      nuts2Elegiveis: [...new Set(nuts)],
      exigeBaixaDensidade: p.exigeBaixaDensidade === true,
      naturezasElegiveis: lista(p.naturezasElegiveis),
      estado: "por_validar",
      notas: nota,
    },
  };
}
