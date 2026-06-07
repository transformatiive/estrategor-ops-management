import {
  NUTS,
  parseMeritGrid,
  type AccessCondition,
  type AvisoElegibilidadeLike,
  type MeritGridData,
} from "@estrategor/shared";
import { env } from "../env.js";
import { extractPdfText, looksLikePdf } from "../ai/pdf.js";
import { normalizarNuts2 } from "./aviso.js";

/**
 * Extração da GRELHA DE MÉRITO de um aviso a partir do seu PDF (TRNSF-1038).
 * Espelha o extractor de elegibilidade (extraction/aviso.ts): descarrega o PDF,
 * lê o texto e pede à IA para PROPOR a grelha completa (critérios/subcritérios/
 * opções + condições de acesso + metadados). A proposta NÃO é persistida: o
 * admin revê, corrige no editor visual e só então cria/publica o aviso.
 *
 * Linha vermelha: a IA PROPÕE, nunca inventa. Sem evidência → arrays vazios /
 * null. Qualquer falha degrada graciosamente para um esqueleto vazio + `nota`.
 */
export interface PropostaAviso {
  metadata: {
    programa: string;
    programCode: string;
    medida: string;
    codigo_aviso: string;
    regiao: string | null;
    versao: string;
    fonte_url: string;
    mp_minimo: number | null;
    minimo_por_criterio: number | null;
    formula_mp: string;
    escala: MeritGridData["escala"];
  };
  grid: MeritGridData;
  accessConditions: AccessCondition[];
  eligibilidade: AvisoElegibilidadeLike;
  nota: string;
}

const NUTS2 = NUTS.map((n) => n.nuts2);

function escalaPadrao(): MeritGridData["escala"] {
  return {
    min: 1,
    max: 5,
    descritores: {
      "1": "Muito insuficiente",
      "2": "Insuficiente",
      "3": "Suficiente",
      "4": "Bom",
      "5": "Muito bom",
    },
  };
}

/** Esqueleto vazio editável (degradação graciosa em qualquer falha). */
function rascunho(url: string, nota: string): PropostaAviso {
  const escala = escalaPadrao();
  const grid: MeritGridData = {
    programa: "PT2030",
    medida: "",
    codigo_aviso: "",
    regiao: null,
    versao: "",
    fonte_url: url || undefined,
    escala,
    mp_minimo: 3,
    minimo_por_criterio: 3,
    formula_mp: "",
    criterios: [],
  };
  return {
    metadata: {
      programa: "PT2030",
      programCode: "PT2030",
      medida: "",
      codigo_aviso: "",
      regiao: null,
      versao: "",
      fonte_url: url,
      mp_minimo: 3,
      minimo_por_criterio: 3,
      formula_mp: "",
      escala,
    },
    grid,
    accessConditions: [],
    eligibilidade: {
      caeElegiveis: [],
      nuts2Elegiveis: [],
      exigeBaixaDensidade: false,
      naturezasElegiveis: [],
      estado: "por_validar",
      notas: nota,
      fonteUrl: url || null,
    },
    nota,
  };
}

export async function extrairGrelhaDoAviso(
  url: string,
): Promise<PropostaAviso> {
  if (!/^https?:\/\//i.test(url))
    return rascunho(url, "URL do aviso inválido — preencher manualmente.");
  if (!env.OPENROUTER_API_KEY) {
    return rascunho(
      url,
      "Extração IA indisponível (sem chave) — preencher manualmente.",
    );
  }

  let buffer: Buffer;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok)
      return rascunho(
        url,
        `Não foi possível descarregar o PDF (HTTP ${res.status}).`,
      );
    buffer = Buffer.from(await res.arrayBuffer());
  } catch {
    return rascunho(url, "Falha ao descarregar o PDF do aviso.");
  }

  if (!looksLikePdf(buffer))
    return rascunho(url, "O URL não aponta para um PDF legível.");
  const texto = await extractPdfText(buffer, 24000);
  if (!texto)
    return rascunho(
      url,
      "Não foi possível ler texto do PDF (pode estar digitalizado).",
    );

  try {
    return await chamarIA(texto, url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[grelha] extração por IA falhou:", msg);
    return rascunho(
      url,
      `Falha na extração por IA (${msg}) — preencher manualmente.`,
    );
  }
}

/** Slug simples a partir de uma etiqueta (chave da condição de acesso). */
function slug(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "cond"
  );
}

function numeroOuNull(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

async function chamarIA(texto: string, url: string): Promise<PropostaAviso> {
  const system =
    "És um analista de avisos de candidaturas a fundos (PT2030). Lês o texto do aviso e " +
    "extrais a GRELHA DE MÉRITO completa e as CONDIÇÕES DE ACESSO. Respondes só com JSON " +
    "estrito. Não inventas: se não encontrares um valor, deixa o campo vazio (array vazio, " +
    "string vazia ou null). Nunca acrescentas critérios/opções que não estejam no texto.";

  const instruction =
    "Do texto do aviso, extrai EXATAMENTE este JSON (sem comentários):\n" +
    "{\n" +
    '  "medida": string,            // designação da medida/SI\n' +
    '  "codigo_aviso": string,      // ex.: "MPr-2025-2"\n' +
    `  "regiao": string|null,       // se a grelha for específica de uma região, usa um destes nomes NUTS II: ${NUTS2.join(", ")}; senão null\n` +
    '  "versao": string,            // data/versão do aviso (ex.: "2025-03-10") ou ""\n' +
    '  "mp_minimo": number|null,    // pontuação de mérito mínima global\n' +
    '  "minimo_por_criterio": number|null,\n' +
    '  "formula_mp": string,        // ex.: "0.30*A + 0.30*B + 0.15*C + 0.25*D"\n' +
    '  "escala": { "min": number, "max": number, "descritores": { [pts: string]: string } },\n' +
    '  "criterios": [\n' +
    '    { "codigo": "A", "nome": string, "peso": number,\n' +
    '      "formula": string?,      // fórmula interna entre subcritérios, ex.: "0.50*B.1 + 0.35*B.3"; omite se não houver\n' +
    '      "subcriterios": [\n' +
    '        { "codigo": "A.1", "nome": string, "weight": number?,\n' +
    '          "options": [ { "label": string, "pts": number, "note": string? } ],\n' +
    '          "regionalOptions": { [regiaoNUTS2: string]: [ { "label": string, "pts": number } ] }?\n' +
    "        }\n" +
    "      ]\n" +
    "    }\n" +
    "  ],\n" +
    '  "accessConditions": [ { "label": string } ],  // condições de acesso (§7.1); só a etiqueta\n' +
    '  "nota": string                                 // 1 frase com a base (secção/anexo)\n' +
    "}\n\n" +
    "Regras:\n" +
    "- Um subcritério tem `options` (lista de opções pontuáveis) OU `regionalOptions` (quando varia por região), nunca ambos.\n" +
    "- `pts` e `peso` são números (usa ponto decimal).\n" +
    "- Se a grelha não variar por região, mete regiao=null e usa `options` em todos os subcritérios.\n\n" +
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
      // rota de modelo longo/estruturado (fallback para o modelo base)
      model: env.OPENROUTER_MODEL_OPUS || env.OPENROUTER_MODEL,
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
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter: resposta vazia.");
  // alguns modelos devolvem o JSON dentro de ```json … ``` — remover a cerca
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const p = JSON.parse(cleaned) as Record<string, unknown>;

  return montarProposta(p, url);
}

/** Constrói a proposta a partir do JSON da IA, com normalização defensiva. */
function montarProposta(
  p: Record<string, unknown>,
  url: string,
): PropostaAviso {
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const regiao = str(p.regiao) ? normalizarNuts2(str(p.regiao)) : null;
  const escala = lerEscala(p.escala);
  const criterios = lerCriterios(p.criterios);
  const formulaMp = str(p.formula_mp);

  const grid: MeritGridData = {
    programa: "PT2030",
    medida: str(p.medida),
    codigo_aviso: str(p.codigo_aviso),
    regiao,
    versao: str(p.versao),
    fonte_url: url || undefined,
    escala,
    mp_minimo: numeroOuNull(p.mp_minimo) ?? 3,
    minimo_por_criterio: numeroOuNull(p.minimo_por_criterio) ?? 3,
    formula_mp: formulaMp,
    criterios,
  };

  const accessConditions = Array.isArray(p.accessConditions)
    ? (p.accessConditions as unknown[])
        .map((c) => {
          const obj = (c ?? {}) as Record<string, unknown>;
          const label = str(obj.label) || str(obj.nome);
          if (!label) return null;
          const key = str(obj.key) || slug(label);
          return { key, label } satisfies AccessCondition;
        })
        .filter((c): c is AccessCondition => !!c)
    : [];

  const notaIA =
    str(p.nota) || "Proposta extraída do PDF do aviso — rever e validar.";

  // Validação: se a grelha não passar, mantemos a proposta em bruto mas avisamos.
  const valida = parseMeritGrid(grid);
  const nota = valida.ok
    ? notaIA
    : `${notaIA} ⚠ A grelha proposta tem problemas a corrigir no editor: ${valida.error}`;

  return {
    metadata: {
      programa: "PT2030",
      programCode: "PT2030",
      medida: grid.medida,
      codigo_aviso: grid.codigo_aviso,
      regiao,
      versao: grid.versao,
      fonte_url: url,
      mp_minimo: grid.mp_minimo,
      minimo_por_criterio: grid.minimo_por_criterio,
      formula_mp: grid.formula_mp,
      escala,
    },
    grid,
    accessConditions,
    eligibilidade: {
      caeElegiveis: [],
      nuts2Elegiveis: regiao ? [regiao] : [],
      exigeBaixaDensidade: false,
      naturezasElegiveis: [],
      estado: "por_validar",
      notas: notaIA,
      fonteUrl: url || null,
    },
    nota,
  };
}

function lerEscala(v: unknown): MeritGridData["escala"] {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const min = numeroOuNull(o.min);
    const max = numeroOuNull(o.max);
    const descritores =
      o.descritores && typeof o.descritores === "object"
        ? Object.fromEntries(
            Object.entries(o.descritores as Record<string, unknown>).map(
              ([k, val]) => [k, String(val)],
            ),
          )
        : escalaPadrao().descritores;
    if (min !== null && max !== null) return { min, max, descritores };
  }
  return escalaPadrao();
}

function lerCriterios(v: unknown): MeritGridData["criterios"] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const formula =
      typeof o.formula === "string" && o.formula.trim()
        ? o.formula.trim()
        : undefined;
    return {
      codigo: String(o.codigo ?? "").trim(),
      nome: String(o.nome ?? "").trim(),
      peso: numeroOuNull(o.peso) ?? 0,
      ...(formula ? { formula } : {}),
      subcriterios: lerSubcriterios(o.subcriterios),
    };
  });
}

function lerSubcriterios(
  v: unknown,
): MeritGridData["criterios"][number]["subcriterios"] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const weight = numeroOuNull(o.weight);
    const options = lerOpcoes(o.options);
    const regionalOptions = lerRegionalOptions(o.regionalOptions);
    return {
      codigo: String(o.codigo ?? "").trim(),
      nome: String(o.nome ?? "").trim(),
      ...(weight !== null ? { weight } : {}),
      ...(options.length ? { options } : {}),
      ...(regionalOptions ? { regionalOptions } : {}),
    };
  });
}

function lerOpcoes(v: unknown) {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((op) => {
      const o = (op ?? {}) as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      const pts = numeroOuNull(o.pts);
      if (!label || pts === null) return null;
      const note =
        typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined;
      return note ? { label, pts, note } : { label, pts };
    })
    .filter((o): o is { label: string; pts: number; note?: string } => !!o);
}

function lerRegionalOptions(
  v: unknown,
): Record<string, ReturnType<typeof lerOpcoes>> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, ReturnType<typeof lerOpcoes>> = {};
  for (const [regiao, opts] of Object.entries(v as Record<string, unknown>)) {
    const canon = normalizarNuts2(regiao) ?? regiao.trim();
    const lidas = lerOpcoes(opts);
    if (canon && lidas.length) out[canon] = lidas;
  }
  return Object.keys(out).length ? out : undefined;
}
