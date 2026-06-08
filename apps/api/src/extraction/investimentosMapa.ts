import type { NovaInvestimentoLinha } from "@estrategor/shared";
import { norm, toNumber, type SheetData } from "./xlsx.js";

/**
 * Parser determinístico do Mapa de Investimentos (Excel da Estrategor) para as
 * linhas de investimento/custos da candidatura (TRNSF-1070). Reconhece os
 * cabeçalhos por sinónimos e ignora linhas de total/vazias. Puro e testável.
 */

const SYN = {
  designacao: ["designacao", "descricao", "rubrica", "item", "equipamento", "bem", "aquisicao", "investimento"],
  categoria: ["categoria", "tipologia", "natureza", "tipo de custo", "tipo"],
  elegivel: ["elegivel", "valor elegivel", "montante elegivel", "investimento elegivel", "custo elegivel", "montante", "valor", "custo"],
  data: ["data", "calendarizacao", "mes", "data de aquisicao"],
  ano: ["ano", "exercicio", "periodo"],
  estabelecimento: ["estabelecimento", "local", "instalacao", "unidade"],
  ef: ["ef", "efeito incentivo", "efeito de incentivo", "efeito"],
};

function matchCol(cells: (string | number | null)[], syns: string[]): number {
  // procura por correspondência mais específica primeiro (sinónimos por ordem)
  for (const s of syns) {
    const idx = cells.findIndex((c) => {
      const n = norm(c);
      return n.length > 0 && n.includes(s);
    });
    if (idx >= 0) return idx;
  }
  return -1;
}

function isYear(v: unknown): number | null {
  const n = toNumber(v as string | number | null);
  return n != null && Number.isInteger(n) && n >= 2000 && n <= 2099 ? n : null;
}

const cellStr = (row: (string | number | null)[], col: number): string | null =>
  col >= 0 && row[col] != null ? String(row[col]).trim() : null;

/** Deriva uma data aaaa-mm a partir de várias formas comuns; null se indecifrável. */
function parseData(v: string | number | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  let m = /^(\d{4})[-/](\d{1,2})/.exec(s); // 2026-03 / 2026/3
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[-/](\d{4})$/.exec(s); // 03/2026
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}`;
  m = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(s); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2]}`;
  const y = isYear(s);
  return y ? `${y}-01` : null;
}

function isTruthy(v: string | number | null): boolean {
  if (v == null) return false;
  if (typeof v === "number") return v !== 0;
  const n = norm(v);
  return ["sim", "s", "x", "true", "verdadeiro", "1", "ef"].includes(n);
}

interface Cols {
  designacao: number;
  categoria: number;
  elegivel: number;
  data: number;
  ano: number;
  estabelecimento: number;
  ef: number;
}

function findHeader(sheet: SheetData): { idx: number; cols: Cols } | null {
  const limit = Math.min(sheet.rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = sheet.rows[i];
    if (!row) continue;
    const designacao = matchCol(row, SYN.designacao);
    const elegivel = matchCol(row, SYN.elegivel);
    if (designacao >= 0 && elegivel >= 0 && designacao !== elegivel) {
      return {
        idx: i,
        cols: {
          designacao,
          elegivel,
          categoria: matchCol(row, SYN.categoria),
          data: matchCol(row, SYN.data),
          ano: matchCol(row, SYN.ano),
          estabelecimento: matchCol(row, SYN.estabelecimento),
          ef: matchCol(row, SYN.ef),
        },
      };
    }
  }
  return null;
}

export interface MapaInvestimentosResultado {
  linhas: NovaInvestimentoLinha[];
  nota: string | null;
}

/** Lê todas as folhas e extrai as linhas de investimento reconhecíveis. */
export function parseMapaInvestimentos(sheets: SheetData[]): MapaInvestimentosResultado {
  const linhas: NovaInvestimentoLinha[] = [];
  for (const sheet of sheets) {
    const header = findHeader(sheet);
    if (!header) continue;
    const { idx, cols } = header;
    for (let i = idx + 1; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      if (!row) continue;
      const designacao = cellStr(row, cols.designacao);
      const elegivel = toNumber(row[cols.elegivel] ?? null);
      if (!designacao || elegivel == null || elegivel === 0) continue;
      if (norm(designacao).startsWith("total")) continue; // linha de soma

      const dataAquisicao =
        (cols.data >= 0 ? parseData(row[cols.data] ?? null) : null) ??
        (cols.ano >= 0 ? (isYear(row[cols.ano] ?? null) ? `${isYear(row[cols.ano] ?? null)}-01` : null) : null);

      linhas.push({
        designacao,
        categoria: cols.categoria >= 0 ? (cellStr(row, cols.categoria) ?? "") : "",
        elegivel,
        dataAquisicao,
        estabelecimento: cols.estabelecimento >= 0 ? cellStr(row, cols.estabelecimento) : null,
        ef: cols.ef >= 0 ? isTruthy(row[cols.ef] ?? null) : false,
      });
    }
  }
  const nota = linhas.length
    ? null
    : "Cabeçalhos do mapa de investimentos não reconhecidos (precisa de colunas de designação e montante elegível).";
  return { linhas, nota };
}
