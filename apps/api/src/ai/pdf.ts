import { PDFDocument } from "pdf-lib";

/** Verdadeiro se o buffer parece um PDF (header %PDF-). */
export function looksLikePdf(content: Buffer): boolean {
  return content.length >= 5 && content.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Conta as páginas de um PDF; 1 para não-PDF ou em caso de erro. */
export async function countPages(content: Buffer, mimeType: string): Promise<number> {
  if (mimeType !== "application/pdf" || !looksLikePdf(content)) return 1;
  try {
    const doc = await PDFDocument.load(content, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 1;
  }
}

/**
 * Extrai um intervalo de páginas (1-based, inclusivo) de um PDF para um novo
 * PDF (divisão física — TRNSF-938 E-03). Devolve o original se não for um PDF
 * válido.
 */
export async function extractPages(
  content: Buffer,
  startPage: number,
  endPage: number,
): Promise<Buffer> {
  if (!looksLikePdf(content)) return content;
  try {
    const src = await PDFDocument.load(content, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const total = src.getPageCount();
    const from = Math.max(1, startPage);
    const to = Math.min(total, endPage);
    const indices: number[] = [];
    for (let i = from; i <= to; i++) indices.push(i - 1);
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    return Buffer.from(bytes);
  } catch {
    return content;
  }
}
