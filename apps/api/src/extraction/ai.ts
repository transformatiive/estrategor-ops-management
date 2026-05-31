import type { ExtractedField } from "@estrategor/shared";
import { env } from "../env.js";
import { extractPdfText } from "../ai/pdf.js";
import { emptyOutput, type ExtractInput, type ExtractorOutput } from "./types.js";

/** Especificação dos campos a extrair por IA, por tipo de documento. É DADOS:
 *  liga cada documento não estruturado à secção e aos campos da candidatura. */
interface FieldSpec {
  key: string;
  label: string;
  tipo: "texto" | "numero" | "data" | "tabela";
  descricao: string;
}

const IA_SPECS: Record<string, { section: string; fields: FieldSpec[] }> = {
  CERTIDAO_PERMANENTE: {
    section: "beneficiario",
    fields: [
      { key: "nif", label: "NIF / NIPC", tipo: "texto", descricao: "número de identificação fiscal da empresa" },
      { key: "nome", label: "Denominação social", tipo: "texto", descricao: "nome completo da sociedade" },
      { key: "cae_principal", label: "CAE principal", tipo: "texto", descricao: "código CAE da atividade principal" },
      { key: "natureza_juridica", label: "Natureza jurídica", tipo: "texto", descricao: "forma jurídica (ex.: Lda, S.A.)" },
      { key: "capital_social", label: "Capital social", tipo: "numero", descricao: "capital social em euros" },
    ],
  },
  RCBE: {
    section: "beneficiario",
    fields: [
      { key: "rcbe_estado", label: "Estado do RCBE", tipo: "texto", descricao: "situação do registo (ex.: válido, atualizado)" },
      { key: "rcbe_data", label: "Data do RCBE", tipo: "data", descricao: "data da declaração/última atualização (AAAA-MM-DD)" },
    ],
  },
  INTENCOES_INVESTIMENTO: {
    section: "investimentos",
    fields: [
      {
        key: "linhas_investimento",
        label: "Linhas de investimento",
        tipo: "tabela",
        descricao: "lista de {designacao, montante (€), fornecedor} dos orçamentos",
      },
    ],
  },
};

export function aiSpecFor(tipoDocumento: string) {
  return IA_SPECS[tipoDocumento];
}

/**
 * Motor de extração por IA (fallback para documentos sem estrutura). Usa a
 * OpenRouter (Claude) quando há OPENROUTER_API_KEY; caso contrário devolve vazio
 * com nota (a validação humana preenche). A IA propõe COM confiança por campo;
 * nada é dado como final sem confirmação humana.
 */
export async function extractWithAi(input: ExtractInput): Promise<ExtractorOutput> {
  const spec = IA_SPECS[input.tipoDocumento];
  if (!spec) return emptyOutput("ia", "Sem extractor de IA para este tipo de documento.");
  if (!env.OPENROUTER_API_KEY) {
    return emptyOutput("ia", "IA indisponível (sem chave) — preencher manualmente.");
  }
  try {
    return await callOpenRouter(input, spec);
  } catch {
    return emptyOutput("ia", "Falha na extração por IA — preencher manualmente.");
  }
}

async function callOpenRouter(
  input: ExtractInput,
  spec: { section: string; fields: FieldSpec[] },
): Promise<ExtractorOutput> {
  const fieldList = spec.fields
    .map((f) => `- ${f.key} (${f.tipo}): ${f.label} — ${f.descricao}`)
    .join("\n");

  const system =
    "És um extractor de dados de documentos de candidaturas a fundos (PT2030). " +
    "Lês o documento e extrais apenas os campos pedidos. Respondes só com JSON. " +
    "Para cada campo dás uma confiança 0..1; se não encontrares, devolves value=null e confianca=0.";

  const instruction =
    `Documento: "${input.filename}" (tipo ${input.tipoDocumento}).\n\n` +
    `Campos a extrair:\n${fieldList}\n\n` +
    "Devolve JSON com este formato exato:\n" +
    '{"campos": [{"key": string, "value": <valor|null>, "confianca": number}], "nota": string|null}\n' +
    "Usa exatamente as keys indicadas. Para tipo 'tabela', value é um array de objetos.";

  const isPdf = input.mimeType === "application/pdf";
  const isImage = input.mimeType.startsWith("image/");
  const userContent: unknown[] = [{ type: "text", text: instruction }];
  if (isImage) {
    userContent.push({ type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.content.toString("base64")}` } });
  } else if (isPdf) {
    const text = await extractPdfText(input.content, 12000);
    if (text) {
      userContent.push({ type: "text", text: `Conteúdo do PDF (excerto):\n${text}` });
    } else {
      userContent.push({ type: "file", file: { filename: input.filename, file_data: `data:application/pdf;base64,${input.content.toString("base64")}` } });
      userContent.push({ type: "text", text: "PDF digitalizado (sem texto). Lê o documento e extrai os campos." });
    }
  } else {
    userContent.push({ type: "text", text: `Excerto:\n${input.content.toString("utf8").slice(0, 8000)}` });
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
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  const parsed = JSON.parse(raw) as { campos?: { key: string; value: unknown; confianca?: number }[]; nota?: string | null };

  const byKey = new Map((parsed.campos ?? []).map((c) => [c.key, c]));
  const campos: ExtractedField[] = [];
  let confSum = 0;
  let confN = 0;
  for (const f of spec.fields) {
    const got = byKey.get(f.key);
    if (!got || got.value == null || got.value === "") continue;
    const confianca = Math.max(0, Math.min(1, Number(got.confianca) || 0));
    confSum += confianca;
    confN += 1;
    campos.push({ section: spec.section, key: f.key, label: f.label, value: got.value, confianca });
  }
  if (campos.length === 0) {
    return emptyOutput("ia", parsed.nota ?? "A IA não encontrou os campos no documento.");
  }
  return {
    metodo: "ia",
    confianca: confN ? confSum / confN : 0,
    campos,
    nota: parsed.nota ?? null,
  };
}
