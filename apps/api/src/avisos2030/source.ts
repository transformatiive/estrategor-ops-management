/**
 * Conector aos avisos do Portugal 2030 (TRNSF-1072 · F1).
 *
 * Fonte: a REST API padrão do WordPress do portal expõe o post type
 * `aviso-2024` com paginação normal (`per_page`/`page`, header `X-WP-Total`) e
 * um bloco `acf` estruturado por aviso (código, programa/marca, NUTS, datas,
 * tipologias, beneficiário, dotações, comparticipação e o ID de media do PDF).
 * Robusto e sem nonce — agrega TODOS os programas regionais/temáticos.
 *
 * O PDF de cada aviso resolve-se em 2 passos: o `acf.pdf` é um ID de media →
 * `/wp/v2/media/{id}` devolve o `source_url`.
 */

const BASE = process.env.AVISOS2030_BASE?.replace(/\/$/, "") || "https://portugal2030.pt/wp-json";
const PER_PAGE = 100;
const FETCH_TIMEOUT_MS = 25_000;

/** Aviso normalizado a partir do `acf` do portal. */
export interface Aviso2030 {
  externalId: number;
  codigo: string;
  titulo: string;
  programa: string | null; // marca (ex.: COMPETE2030, ALGARVE2030)
  natureza: string | null; // ex.: "Concurso" (vs contínuo)
  nuts: string[];
  beneficiario: string[];
  tipologiaOperacao: string[];
  dataInicio: Date | null;
  dataFim: Date | null;
  dotacao: number | null;
  comparticipacao: string | null;
  pdfMediaId: number | null;
  link: string | null;
}

/** "YYYYMMDD" (formato do portal) → Date (UTC) ou null. */
export function parseYmd(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

const firstString = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim() || null;
  return null;
};

const asNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

interface RawAviso {
  id?: number;
  link?: string;
  title?: { rendered?: string };
  acf?: Record<string, unknown>;
}

/** Mapeia um item cru do WP REST para o aviso normalizado (puro, testável). */
export function mapAviso(item: RawAviso): Aviso2030 | null {
  const acf = item.acf ?? {};
  const codigo = firstString(acf.codigo);
  if (!item.id || !codigo) return null; // sem id/código não é utilizável
  return {
    externalId: item.id,
    codigo,
    titulo: (item.title?.rendered ?? "").trim() || codigo,
    programa: firstString(acf.programa),
    natureza: firstString(acf.natureza),
    nuts: asArray(acf.nuts),
    beneficiario: asArray(acf.beneficiario),
    tipologiaOperacao: asArray(acf.tipologia_operacao),
    dataInicio: parseYmd(acf.data_inicio),
    dataFim: parseYmd(acf.data_fim),
    dotacao: asNumber(acf.df),
    comparticipacao: firstString(acf.comparticipacao),
    pdfMediaId: asNumber(acf.pdf),
    link: typeof item.link === "string" ? item.link : null,
  };
}

/**
 * Está aberto? Sem data de fim → tratado como contínuo (aberto). Caso contrário
 * o fim ainda não passou. (Filtro de relevância é separado — F2.)
 */
export function isOpen(a: Aviso2030, now: Date = new Date()): boolean {
  if (!a.dataFim) return true;
  return a.dataFim.getTime() >= now.getTime();
}

async function getJson(url: string): Promise<{ data: unknown; totalPages: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1") || 1;
    return { data: await res.json(), totalPages };
  } finally {
    clearTimeout(t);
  }
}

/** Busca TODOS os avisos do portal (paginado) e devolve os normalizados. */
export async function fetchAvisos2030(): Promise<Aviso2030[]> {
  const fields = "id,link,title.rendered,acf";
  const first = await getJson(`${BASE}/wp/v2/aviso-2024?per_page=${PER_PAGE}&page=1&_fields=${fields}`);
  const out: Aviso2030[] = [];
  const collect = (data: unknown) => {
    if (Array.isArray(data)) for (const it of data) {
      const a = mapAviso(it as RawAviso);
      if (a) out.push(a);
    }
  };
  collect(first.data);
  for (let page = 2; page <= first.totalPages; page++) {
    const { data } = await getJson(`${BASE}/wp/v2/aviso-2024?per_page=${PER_PAGE}&page=${page}&_fields=${fields}`);
    collect(data);
  }
  return out;
}

/** Resolve o URL do PDF a partir do ID de media (`acf.pdf`). */
export async function resolvePdfUrl(mediaId: number): Promise<string | null> {
  try {
    const { data } = await getJson(`${BASE}/wp/v2/media/${mediaId}?_fields=source_url`);
    const url = (data as { source_url?: unknown })?.source_url;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
}
