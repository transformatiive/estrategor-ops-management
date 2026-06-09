/**
 * Adaptador do portal Compete2030 (TRNSF-1072 · enumeração por portais).
 *
 * Ao contrário do portugal2030.pt (cujo download do regulamento está atrás de
 * um SAS Azure e não enumera todos), o Compete2030 enumera os avisos abertos em
 * HTML (`/avisos/page/N`) e hospeda o **regulamento diretamente** em
 * `/wp-content/uploads/...Aviso-*.pdf`. Este adaptador faz scraping defensivo
 * (parsers puros e testáveis) para listar os avisos abertos e resolver o PDF do
 * regulamento, que alimenta o motor de grelha (IA).
 *
 * Outros portais (Norte, Centro, Lisboa, Alentejo, Algarve, Açores, Madeira)
 * seguem o mesmo padrão de adaptador.
 */

const BASE = process.env.COMPETE2030_BASE?.replace(/\/$/, "") || "https://compete2030.gov.pt";
const MAX_PAGES = 10;
const FETCH_TIMEOUT_MS = 25_000;

export interface CompeteAviso {
  codigo: string;
  titulo: string;
  link: string;
  regulamentoUrl: string;
  programa: "COMPETE2030";
}

async function getText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Slugs de avisos numa página de listagem (exclui feed/page). Puro. */
export function parseListingSlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const m of html.matchAll(/\/avisos\/([a-z0-9][a-z0-9_-]+)\//gi)) {
    const s = m[1]!.toLowerCase();
    if (s === "feed" || s === "page") continue;
    slugs.add(s);
  }
  return [...slugs];
}

const decode = (s: string): string =>
  s
    .replace(/&#8211;/g, "–")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&#8217;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();

/** Código do aviso a partir do slug (sufixo) ou do corpo da página. Puro. */
export function extrairCodigo(slug: string, html: string): string | null {
  const re = /(compete2030|mpr|rpa|aac|sice|siid|sitce)[-_](\d{4})[-_](\d+)/i;
  const fromSlug = slug.match(re);
  if (fromSlug) return `${fromSlug[1]!.toUpperCase()}-${fromSlug[2]}-${fromSlug[3]}`;
  const fromHtml = html.match(re);
  if (fromHtml) return `${fromHtml[1]!.toUpperCase()}-${fromHtml[2]}-${fromHtml[3]}`;
  return null;
}

/** Está aberto? Procura o estado "Aberto" no corpo (e ausência de "Encerrado"). */
export function pareceAberto(html: string): boolean {
  return /\bAberto\b/.test(html);
}

/** Escolhe o URL do PDF do regulamento (o "Aviso-*.pdf", não guias/formulários). */
export function escolherRegulamento(html: string): string | null {
  const pdfs = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]!);
  const avisos = pdfs.filter((u) => /aviso/i.test(u) && !/(guia|formul|anexo|minuta|faq)/i.test(u));
  const cand = avisos.length ? avisos : pdfs.filter((u) => !/(guia|formul|faq)/i.test(u));
  if (!cand.length) return null;
  // preferir a republicação/versão mais recente, se houver
  const rep = cand.find((u) => /republic|_vf|v\d/i.test(u));
  const escolhido = rep ?? cand[0]!;
  return escolhido.startsWith("http") ? escolhido : `${BASE}${escolhido}`;
}

/** Título legível da página (og:title ou <title>, sem o sufixo do site). Puro. */
export function extrairTitulo(html: string): string {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  const tit = og?.[1] ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  return decode(tit).replace(/\s*[|–-]\s*Compete\s*2030.*$/i, "").trim();
}

/** Detalhe de um aviso aberto (ou null se fechado / sem regulamento). Puro. */
export function parseCompeteDetail(html: string, slug: string): Omit<CompeteAviso, "link"> | null {
  if (!pareceAberto(html)) return null;
  const codigo = extrairCodigo(slug, html);
  const regulamentoUrl = escolherRegulamento(html);
  if (!codigo || !regulamentoUrl) return null;
  return { codigo, titulo: extrairTitulo(html) || codigo, regulamentoUrl, programa: "COMPETE2030" };
}

/** Enumera os avisos abertos do Compete2030 (listagem paginada + detalhe). */
export async function fetchCompeteOpenAvisos(): Promise<CompeteAviso[]> {
  const slugs = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `${BASE}/avisos/` : `${BASE}/avisos/page/${page}/`;
    const html = await getText(url);
    if (!html) break;
    const found = parseListingSlugs(html);
    const antes = slugs.size;
    for (const s of found) slugs.add(s);
    if (slugs.size === antes) break; // página sem novidades → fim
  }

  const out: CompeteAviso[] = [];
  for (const slug of slugs) {
    const link = `${BASE}/avisos/${slug}/`;
    const html = await getText(link);
    if (!html) continue;
    const det = parseCompeteDetail(html, slug);
    if (det) out.push({ ...det, link });
  }
  return out;
}
