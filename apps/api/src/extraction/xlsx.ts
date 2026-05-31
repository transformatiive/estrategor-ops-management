import ExcelJS from "exceljs";

export interface SheetData {
  name: string;
  /** células por linha (texto/número/null), na ordem das colunas */
  rows: (string | number | null)[][];
}

const XLSX_SIGNATURE = Buffer.from("PK"); // ficheiros .xlsx são ZIP (começam por "PK")

/** Heurística leve: o conteúdo parece um ficheiro Office Open XML (.xlsx). */
export function looksLikeXlsx(content: Buffer, mimeType: string): boolean {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return true;
  return content.length >= 2 && content.subarray(0, 2).equals(XLSX_SIGNATURE);
}

/**
 * Lê um workbook .xlsx a partir de um buffer e devolve as folhas como matrizes
 * de células. Determinístico (sem IA). Devolve null se o ficheiro não for um
 * .xlsx legível — o motor cai então para o fallback de IA.
 */
export async function readSheets(content: Buffer): Promise<SheetData[] | null> {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(content as unknown as ArrayBuffer);
    const sheets: SheetData[] = [];
    wb.eachSheet((ws) => {
      const rows: (string | number | null)[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: (string | number | null)[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const v = cell.value;
          if (v == null) cells.push(null);
          else if (typeof v === "number") cells.push(v);
          else if (typeof v === "object" && "result" in v) cells.push((v.result as number | string) ?? null);
          else cells.push(String((v as { text?: string }).text ?? v));
        });
        rows.push(cells);
      });
      sheets.push({ name: ws.name, rows });
    });
    return sheets.length ? sheets : null;
  } catch {
    return null;
  }
}

/** Normaliza um texto para comparação de cabeçalhos (sem acentos, minúsculas). */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Converte um valor de célula em número, tolerando o formato PT
 * (1.234.567,89 → 1234567.89) e símbolos de moeda/percentagem.
 */
export function toNumber(v: string | number | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v
    .replace(/[€%\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhares
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== "" ? n : null;
}
