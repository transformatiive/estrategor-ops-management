import {
  DOCUMENT_TAXONOMY,
  stubClassify,
  type ClassificationResult,
} from "@estrategor/shared";
import { env } from "../env.js";

export interface ClassifyInput {
  originalFilename: string;
  mimeType: string;
  content: Buffer;
  pageCount: number;
  /** tipos candidatos (ex.: os pedidos na recolha) para restringir a proposta */
  candidateKeys?: string[];
}

/** Modo do classificador em uso ("openrouter" | "stub"). */
export function classifierMode(): "openrouter" | "stub" {
  return env.OPENROUTER_API_KEY ? "openrouter" : "stub";
}

/**
 * Classifica um documento (TRNSF-938 E-01/E-02). Usa a OpenRouter (Claude) quando
 * há OPENROUTER_API_KEY; caso contrário um classificador-stub determinístico.
 * Qualquer falha da IA cai no stub — o pipeline nunca bloqueia, e a validação
 * humana é sempre exigida a jusante.
 */
export async function classifyDocument(input: ClassifyInput): Promise<ClassificationResult> {
  if (!env.OPENROUTER_API_KEY) {
    return stubClassify(input.originalFilename, input.pageCount, input.candidateKeys);
  }
  try {
    return await classifyWithOpenRouter(input);
  } catch {
    // fallback resiliente ao stub (assinala revisão por confiança baixa)
    const r = stubClassify(input.originalFilename, input.pageCount, input.candidateKeys);
    return { ...r, confidence: Math.min(r.confidence, 0.4), rationale: "Fallback (IA indisponível)." };
  }
}

async function classifyWithOpenRouter(input: ClassifyInput): Promise<ClassificationResult> {
  const taxonomy = (input.candidateKeys?.length
    ? DOCUMENT_TAXONOMY.filter((d) => input.candidateKeys!.includes(d.key))
    : DOCUMENT_TAXONOMY
  ).map((d) => `- ${d.key}: ${d.name} — ${d.purpose}`).join("\n");

  const isPdf = input.mimeType === "application/pdf";
  const isImage = input.mimeType.startsWith("image/");

  const system =
    "És um classificador de documentos de candidaturas a fundos (PT2030). " +
    "Identificas o tipo de cada documento a partir de uma taxonomia fechada e " +
    "detetas se um ficheiro contém vários documentos. Respondes só com JSON.";

  const instruction =
    `Taxonomia (usa exatamente estas keys):\n${taxonomy}\n\n` +
    `Ficheiro: "${input.originalFilename}" (${input.mimeType}, ${input.pageCount} página(s)).\n\n` +
    "Devolve JSON com este formato exato:\n" +
    '{"proposedTypeKey": string|null, "confidence": number (0..1), ' +
    '"multiDocument": boolean, "parts": [{"typeKey": string, "startPage": number, "endPage": number}], ' +
    '"rationale": string}\n' +
    "Se for um único documento, proposedTypeKey preenchido e parts vazio. " +
    "Se contiver vários, multiDocument=true, proposedTypeKey=null e parts com as fronteiras por página (1-based).";

  // conteúdo: imagem por data URL (visão); PDF/idênticos por descrição textual
  const userContent: unknown[] = [{ type: "text", text: instruction }];
  if (isImage) {
    const dataUrl = `data:${input.mimeType};base64,${input.content.toString("base64")}`;
    userContent.push({ type: "image_url", image_url: { url: dataUrl } });
  } else if (!isPdf) {
    // texto simples: inclui um excerto
    userContent.push({ type: "text", text: `Excerto:\n${input.content.toString("utf8").slice(0, 4000)}` });
  }

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
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  const parsed = JSON.parse(raw) as ClassificationResult;

  // valida as keys contra a taxonomia (a IA propõe, validamos)
  const valid = new Set(DOCUMENT_TAXONOMY.map((d) => d.key));
  if (parsed.proposedTypeKey && !valid.has(parsed.proposedTypeKey)) parsed.proposedTypeKey = null;
  parsed.parts = (parsed.parts ?? []).filter((p) => valid.has(p.typeKey));
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  parsed.multiDocument = Boolean(parsed.multiDocument) && parsed.parts.length > 1;
  return parsed;
}
