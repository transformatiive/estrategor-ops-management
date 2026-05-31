import { stubDraft, type GenDocTypeDef } from "@estrategor/shared";
import { env } from "../env.js";

/** Fontes injetadas na geração (o dossier do que já existe na candidatura). */
export interface GenSources {
  familyLabel: string;
  codigoAviso: string | null;
  /** factos validados/intake da candidatura (section.key = valor) */
  dossier: string;
  /** orientação dos critérios da grelha de mérito (A/B/C/D) */
  meritGuidance: string;
}

const SYSTEM_TEMPLATE = (def: GenDocTypeDef, familyLabel: string): string =>
  `És um analista sénior de candidaturas PT2030 da Estrategor. Redige o campo ` +
  `"${def.label}" (${def.docType}) de uma candidatura ${familyLabel} em PT-PT (Português Europeu).\n\n` +
  `REGRAS DURAS:\n` +
  `- Usa apenas factos do dossier, do intake e dos precedentes fornecidos.\n` +
  `- Onde faltar informação, insere [A PREENCHER: <descrição>] em vez de inventar.\n` +
  `- Tom técnico-comercial, factual.\n` +
  `- Cumpre o limite de caracteres: ${def.charLimit} (alvo: 95-99%).\n` +
  `- Estrutura com sub-rótulos em MAIÚSCULAS e bullets (• ou -) onde faça sentido.\n` +
  `- Cita regulamentos UE/CE e portarias pelo nome SÓ quando estiverem nos dados fornecidos — nunca inventes referências.\n` +
  `- Não incluas nomes de outras empresas (anonimiza precedentes: Promotor A, etc.).\n` +
  `OUTPUT: texto puro, secções via sub-rótulos. Não devolvas JSON nem comentários.`;

const userPrompt = (def: GenDocTypeDef, s: GenSources, maxChars?: number): string =>
  `INGREDIENTES ESPECÍFICOS deste campo:\n${def.ingredientes}\n\n` +
  `AVISO: ${s.codigoAviso ?? "[A PREENCHER: código do aviso]"}\n\n` +
  `ORIENTAÇÃO DA GRELHA DE MÉRITO:\n${s.meritGuidance || "—"}\n\n` +
  `DOSSIER (factos disponíveis):\n${s.dossier || "(sem dados estruturados ainda)"}\n\n` +
  (maxChars ? `IMPORTANTE: a versão anterior excedeu o limite. Sê mais conciso: máximo ${maxChars} caracteres.\n\n` : "") +
  `Redige agora o campo, respeitando as regras e o limite de ${def.charLimit} caracteres.`;

/** Modelo OpenRouter a usar conforme a rota recomendada do campo. */
function modelFor(def: GenDocTypeDef): string {
  return def.model === "opus" ? env.OPENROUTER_MODEL_OPUS : env.OPENROUTER_MODEL;
}

/**
 * Gera o texto de um campo via OpenRouter (Claude). Campos longos → Opus,
 * curtos/estruturados → Sonnet. Qualquer falha cai na minuta-stub (com
 * marcadores), nunca bloqueia e nunca inventa.
 */
export async function generateText(
  def: GenDocTypeDef,
  sources: GenSources,
  maxChars?: number,
): Promise<{ conteudo: string; viaIa: boolean }> {
  if (!env.OPENROUTER_API_KEY) return { conteudo: stubDraft(def), viaIa: false };
  try {
    const res = await fetch(`${env.OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Estrategor",
      },
      body: JSON.stringify({
        model: modelFor(def),
        messages: [
          { role: "system", content: SYSTEM_TEMPLATE(def, sources.familyLabel) },
          { role: "user", content: userPrompt(def, sources, maxChars) },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("resposta vazia");
    return { conteudo: text, viaIa: true };
  } catch {
    return { conteudo: stubDraft(def), viaIa: false };
  }
}
