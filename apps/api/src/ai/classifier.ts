import {
  DOCUMENT_TAXONOMY,
  stubClassify,
  type ClassificationResult,
} from "@estrategor/shared";
import { env } from "../env.js";
import { extractPdfText } from "./pdf.js";

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

// Acima deste tamanho não enviamos o PDF inteiro por visão (payload grande) —
// recai no texto extraído. 12 MB de PDF ≈ 16 MB em base64.
const MAX_VISION_BYTES = 12 * 1024 * 1024;

// Abaixo deste limiar de confiança NÃO forçamos um tipo (TRNSF-1049): a proposta
// passa a "por identificar" (null) e o consultor escolhe. Assim um documento mal
// classificado não é associado a um tipo errado nem marca um pedido como recebido.
const CLASSIFY_MIN_CONFIDENCE = 0.55;

/** "Por identificar" abaixo do limiar de confiança (não associa tipo errado). */
function withConfidenceFloor(r: ClassificationResult): ClassificationResult {
  if (!r.multiDocument && r.proposedTypeKey && r.confidence < CLASSIFY_MIN_CONFIDENCE) {
    return { ...r, proposedTypeKey: null };
  }
  return r;
}

/**
 * Classifica um documento (TRNSF-938 / TRNSF-1049). Usa a OpenRouter (Claude
 * Sonnet 4.6) a analisar o CONTEÚDO do documento por visão; só quando não há
 * chave (ou a IA falha) cai num classificador-stub determinístico por nome —
 * sempre com confiança baixa, pois a validação humana é exigida a jusante.
 */
export async function classifyDocument(input: ClassifyInput): Promise<ClassificationResult> {
  if (!env.OPENROUTER_API_KEY) {
    return withConfidenceFloor(stubClassify(input.originalFilename, input.pageCount, input.candidateKeys));
  }
  try {
    return withConfidenceFloor(await classifyWithOpenRouter(input));
  } catch (e) {
    // Não esconder a causa: registar para diagnóstico (TRNSF-1049).
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[classifier] IA falhou para "${input.originalFilename}": ${msg}`);
    const r = stubClassify(input.originalFilename, input.pageCount, input.candidateKeys);
    return withConfidenceFloor({
      ...r,
      confidence: Math.min(r.confidence, 0.4),
      rationale: `Classificação por nome (IA indisponível: ${msg.slice(0, 120)}).`,
    });
  }
}

async function classifyWithOpenRouter(input: ClassifyInput): Promise<ClassificationResult> {
  const taxonomy = (input.candidateKeys?.length
    ? DOCUMENT_TAXONOMY.filter((d) => input.candidateKeys!.includes(d.key))
    : DOCUMENT_TAXONOMY
  )
    .map((d) => `- ${d.key}: ${d.name}${d.purpose ? ` — ${d.purpose}` : ""}`)
    .join("\n");

  const isImage = input.mimeType.startsWith("image/");
  const isPdf = input.mimeType === "application/pdf";

  const system =
    "És um classificador de documentos de candidaturas a fundos (PT2030). " +
    "Analisas o CONTEÚDO do documento (texto e aspeto visual), nunca o nome do " +
    "ficheiro, e identificas o tipo a partir de uma taxonomia fechada. Detetas " +
    "se um ficheiro contém vários documentos distintos. Respondes só com JSON.";

  const instruction =
    `Taxonomia (usa exatamente estas keys):\n${taxonomy}\n\n` +
    `Ficheiro: "${input.originalFilename}" (${input.mimeType}, ${input.pageCount} página(s)).\n\n` +
    "Classifica pelo CONTEÚDO do documento (ignora o nome do ficheiro). " +
    "Devolve JSON com este formato exato:\n" +
    '{"proposedTypeKey": string|null, "confidence": number (0..1), ' +
    '"multiDocument": boolean, "parts": [{"typeKey": string, "startPage": number, "endPage": number}], ' +
    '"rationale": string}\n' +
    "Documento único → proposedTypeKey preenchido (key da taxonomia) e parts vazio. " +
    "Vários documentos no mesmo ficheiro → multiDocument=true, proposedTypeKey=null e " +
    "parts com as fronteiras por página (1-based). A confiança reflete a certeza real. " +
    "Se nenhum tipo encaixar, proposedTypeKey=null com confiança baixa.";

  const userContent: unknown[] = [{ type: "text", text: instruction }];
  const body: Record<string, unknown> = {
    model: env.OPENROUTER_MODEL,
    temperature: 0,
  };

  if (isImage) {
    const dataUrl = `data:${input.mimeType};base64,${input.content.toString("base64")}`;
    userContent.push({ type: "image_url", image_url: { url: dataUrl } });
  } else if (isPdf) {
    const text = await extractPdfText(input.content);
    if (input.content.length <= MAX_VISION_BYTES) {
      // Visão nativa do Claude sobre o PDF (texto + aspeto) via OpenRouter.
      const dataUrl = `data:application/pdf;base64,${input.content.toString("base64")}`;
      userContent.push({
        type: "file",
        file: { filename: input.originalFilename, file_data: dataUrl },
      });
      body.plugins = [{ id: "file-parser", pdf: { engine: "native" } }];
    }
    if (text) {
      userContent.push({ type: "text", text: `Texto extraído (apoio):\n${text.slice(0, 4000)}` });
    }
  } else {
    userContent.push({ type: "text", text: `Excerto:\n${input.content.toString("utf8").slice(0, 4000)}` });
  }

  body.messages = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  const res = await fetch(`${env.OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Estrategor",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`.trim());
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  // alguns modelos devolvem o JSON dentro de ```json … ``` — remover a cerca
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as ClassificationResult;

  // valida as keys contra a taxonomia (a IA propõe, validamos)
  const valid = new Set(DOCUMENT_TAXONOMY.map((d) => d.key));
  if (parsed.proposedTypeKey && !valid.has(parsed.proposedTypeKey)) parsed.proposedTypeKey = null;
  parsed.parts = (parsed.parts ?? []).filter((p) => valid.has(p.typeKey));
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  parsed.multiDocument = Boolean(parsed.multiDocument) && parsed.parts.length > 1;
  return parsed;
}
