import type { MeritGridData, MeritOption, MeritSelection, MeritSubcriterion } from "@estrategor/shared";
import { env } from "../env.js";

/**
 * Sugestão assistida por IA da pontuação de MÉRITO de um projecto (TRNSF-1039).
 * Espelha a extração da elegibilidade (extraction/aviso.ts): a IA PROPÕE uma
 * opção/score por subcritério COM justificação, a partir dos dados do projeto +
 * da grelha do aviso. A proposta entra sempre como `por_validar` — o consultor
 * revê, ajusta e GUARDA; a pontuação final é sempre dele.
 *
 * Linha vermelha: nunca inventa. Sem chave / sem contexto / sem evidência para um
 * subcritério → proposta vazia (ou esse subcritério omitido) + nota. Nunca fabrica
 * uma pontuação.
 */
export interface PropostaMerito {
  selection: MeritSelection;
  justificacoes: Record<string, string>;
  nota: string;
}

function rascunho(nota: string): PropostaMerito {
  return { selection: {}, justificacoes: {}, nota };
}

/** Resolve as opções de um subcritério respeitando a matriz regional. */
function optionsFor(sub: MeritSubcriterion, regiao: string | null): MeritOption[] | undefined {
  if (sub.regionalOptions) {
    if (regiao && sub.regionalOptions[regiao]) return sub.regionalOptions[regiao];
    return undefined; // matriz regional sem região resolvida → sem opções
  }
  return sub.options;
}

export async function extrairMeritoDoProjeto(
  grid: MeritGridData,
  contexto: string,
  regiao: string | null,
): Promise<PropostaMerito> {
  if (!env.OPENROUTER_API_KEY) {
    return rascunho("Sugestão IA indisponível (sem chave) — pontue manualmente.");
  }
  const texto = (contexto ?? "").trim();
  if (texto.length < 40) {
    return rascunho(
      "Sem dados suficientes do projeto para sugerir pontuação — recolha mais informação ou pontue manualmente.",
    );
  }

  try {
    const raw = await chamarIA(grid, texto, regiao);
    return normalizarPropostaMerito(grid, raw, regiao);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[merito] sugestão por IA falhou:", msg);
    return rascunho(`Falha na sugestão por IA (${msg}) — pontue manualmente.`);
  }
}

/** Serializa a grelha (apenas o necessário) para o modelo ler, resolvendo a
 *  matriz regional para `regiao`. Subcritérios regionais sem região resolvida
 *  são omitidos (a nota explica). */
function serializarGrelha(
  grid: MeritGridData,
  regiao: string | null,
): { subcriterios: { subcriterio: string; nome: string; opcoes: { indice: number; label: string; pts: number }[] }[]; omitidosRegionais: string[] } {
  const subcriterios: { subcriterio: string; nome: string; opcoes: { indice: number; label: string; pts: number }[] }[] = [];
  const omitidosRegionais: string[] = [];
  for (const crit of grid.criterios) {
    for (const sub of crit.subcriterios) {
      const opts = optionsFor(sub, regiao);
      if (!opts) {
        if (sub.regionalOptions) omitidosRegionais.push(sub.codigo);
        continue;
      }
      subcriterios.push({
        subcriterio: sub.codigo,
        nome: `${crit.codigo}. ${crit.nome} — ${sub.nome}`,
        opcoes: opts.map((o, i) => ({ indice: i, label: o.label, pts: o.pts })),
      });
    }
  }
  return { subcriterios, omitidosRegionais };
}

async function chamarIA(
  grid: MeritGridData,
  contexto: string,
  regiao: string | null,
): Promise<unknown> {
  const { subcriterios, omitidosRegionais } = serializarGrelha(grid, regiao);

  const system =
    "És um analista que pontua uma grelha de mérito de candidaturas a fundos (PT2030). " +
    "A partir do contexto do projeto, ESCOLHES para cada subcritério a opção MELHOR " +
    "SUPORTADA pela evidência. Respondes só com JSON. Linha vermelha: APENAS escolhes " +
    "entre as opções fornecidas (pelo seu índice); NUNCA inventas pontuações nem evidência. " +
    "Se não houver evidência para um subcritério, OMITE-O (não o incluas na resposta).";

  const instruction =
    "Grelha do aviso (subcritérios e respetivas opções, cada uma com o seu índice):\n" +
    JSON.stringify({ subcriterios }, null, 0) +
    (omitidosRegionais.length
      ? `\n\n(Subcritérios regionais omitidos por falta de região resolvida: ${omitidosRegionais.join(", ")}.)`
      : "") +
    "\n\nContexto do projeto (dados recolhidos):\n" +
    contexto +
    "\n\nPara cada subcritério em que o contexto tenha evidência, escolhe o ÍNDICE da " +
    "opção melhor suportada e escreve uma justificação de 1 frase curta citando a " +
    "evidência. Omite os subcritérios sem evidência (não inventes).\n\n" +
    "Formato JSON exato:\n" +
    '{"escolhas": [{"subcriterio": "B.1", "indice": 0, "justificacao": "…"}], "nota": "…"}';

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
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status} ${corpo.slice(0, 180)}`.trim());
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  // alguns modelos devolvem o JSON dentro de ```json … ``` — remover a cerca
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

/**
 * Normaliza a resposta em bruto do modelo numa PropostaMerito válida (função PURA,
 * testável sem rede). Para cada escolha: verifica que o subcritério existe na
 * grelha e que o índice é válido nas opções resolvidas para `regiao`; descarta as
 * inválidas. Constrói selection (codigo→indice) e justificacoes (codigo→texto).
 */
export function normalizarPropostaMerito(
  grid: MeritGridData,
  raw: unknown,
  regiao: string | null,
): PropostaMerito {
  // índice das opções resolvidas por subcritério (respeita a matriz regional)
  const opcoesPorSub = new Map<string, MeritOption[] | undefined>();
  for (const crit of grid.criterios) {
    for (const sub of crit.subcriterios) {
      opcoesPorSub.set(sub.codigo, optionsFor(sub, regiao));
    }
  }

  const obj = (raw ?? {}) as { escolhas?: unknown; nota?: unknown };
  const escolhas = Array.isArray(obj.escolhas) ? obj.escolhas : [];

  const selection: MeritSelection = {};
  const justificacoes: Record<string, string> = {};
  let validas = 0;
  let descartadas = 0;

  for (const item of escolhas) {
    if (!item || typeof item !== "object") {
      descartadas++;
      continue;
    }
    const e = item as { subcriterio?: unknown; indice?: unknown; justificacao?: unknown };
    const codigo = typeof e.subcriterio === "string" ? e.subcriterio.trim() : "";
    const indice = typeof e.indice === "number" ? e.indice : Number(e.indice);
    const opts = opcoesPorSub.get(codigo);
    if (!codigo || !opts || !Number.isInteger(indice) || indice < 0 || indice >= opts.length) {
      descartadas++;
      continue;
    }
    // primeira escolha válida por subcritério vence (determinístico)
    if (selection[codigo] !== undefined) {
      descartadas++;
      continue;
    }
    selection[codigo] = indice;
    const just = typeof e.justificacao === "string" ? e.justificacao.trim() : "";
    if (just) justificacoes[codigo] = just;
    validas++;
  }

  const notaModelo = typeof obj.nota === "string" ? obj.nota.trim() : "";
  let nota: string;
  if (validas === 0) {
    nota = notaModelo || "Sem evidência suficiente nos dados do projeto para propor pontuações — pontue manualmente.";
  } else {
    const base = notaModelo || "Proposta a partir dos dados do projeto — reveja, ajuste e guarde; a pontuação final é sua.";
    nota = descartadas > 0 ? `${base} (${descartadas} sugestão(ões) inválida(s) descartada(s).)` : base;
  }

  return { selection, justificacoes, nota };
}
