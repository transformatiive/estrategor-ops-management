import type { ExtractedField } from "@estrategor/shared";
import { readSheets, looksLikeXlsx, norm, toNumber, type SheetData } from "./xlsx.js";
import { emptyOutput, type ExtractInput, type ExtractorOutput } from "./types.js";

const SYN = {
  mercado: ["mercado", "pais", "destino", "geografia", "regiao", "zona", "cliente"],
  produto: ["produto", "artigo", "bem", "servico", "familia", "categoria", "linha"],
  valor: ["valor", "vendas", "montante", "faturacao", "volume", "total", "euros", "eur"],
  ano: ["ano", "year", "exercicio", "periodo"],
};

function isYear(v: unknown): number | null {
  const n = toNumber(v as string | number | null);
  return n != null && Number.isInteger(n) && n >= 2000 && n <= 2099 ? n : null;
}

function matchCol(cells: (string | number | null)[], syns: string[]): number {
  return cells.findIndex((c) => {
    const n = norm(c);
    return n.length > 0 && syns.some((s) => n.includes(s));
  });
}

interface HeaderCols {
  valor: number;
  mercado: number;
  produto: number;
  ano: number;
}

/** Localiza a linha de cabeçalho (primeiras 15 linhas) com valor + mercado/ano. */
function findHeader(
  sheet: SheetData,
): { idx: number; cols: HeaderCols; yearCols: { col: number; ano: number }[] } | null {
  const limit = Math.min(sheet.rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = sheet.rows[i];
    if (!row) continue;
    const valor = matchCol(row, SYN.valor);
    const mercado = matchCol(row, SYN.mercado);
    const produto = matchCol(row, SYN.produto);
    const ano = matchCol(row, SYN.ano);
    const yearCols = row
      .map((c, col) => ({ col, ano: isYear(c) }))
      .filter((x): x is { col: number; ano: number } => x.ano != null);
    const hasValueAxis = valor >= 0 || yearCols.length > 0;
    if (hasValueAxis && (mercado >= 0 || ano >= 0 || produto >= 0)) {
      return { idx: i, cols: { valor, mercado, produto, ano }, yearCols };
    }
  }
  return null;
}

const cellStr = (row: (string | number | null)[], col: number): string | null =>
  col >= 0 && row[col] != null ? String(row[col]) : null;

interface VendaLinha {
  mercado: string | null;
  produto: string | null;
  ano: number | null;
  valor: number;
}

/** Lê as linhas de venda de uma folha, em formato longo (valor) ou largo (anos). */
function readVendas(sheet: SheetData): VendaLinha[] {
  const header = findHeader(sheet);
  if (!header) return [];
  const { idx, cols, yearCols } = header;
  const linhas: VendaLinha[] = [];
  for (let i = idx + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (!row) continue;
    const mercado = cellStr(row, cols.mercado);
    const produto = cellStr(row, cols.produto);
    if (yearCols.length > 0) {
      // formato largo: uma linha por (mercado, ano)
      for (const yc of yearCols) {
        const valor = toNumber(row[yc.col] ?? null);
        if (valor != null && (mercado || produto)) linhas.push({ mercado, produto, ano: yc.ano, valor });
      }
    } else if (cols.valor >= 0) {
      const valor = toNumber(row[cols.valor] ?? null);
      const ano = cols.ano >= 0 ? isYear(row[cols.ano] ?? null) : null;
      if (valor != null && (mercado || produto)) linhas.push({ mercado, produto, ano, valor });
    }
  }
  return linhas;
}

/**
 * Motor determinístico para o Mapa de Vendas (Excel da Estrategor). Lê as folhas
 * COM CÓDIGO (sem IA), reconhecendo cabeçalhos por sinónimos. Vendas diretas
 * → secção `mercado_linhas`; folhas de vendas indiretas (nome com "indiret")
 * → `exportacoes_indiretas`. Sem estrutura reconhecível, devolve vazio.
 */
export async function extractMapaVendas(input: ExtractInput): Promise<ExtractorOutput> {
  if (!looksLikeXlsx(input.content, input.mimeType)) {
    return emptyOutput("deterministico", "Mapa de vendas não está em formato Excel.");
  }
  const sheets = await readSheets(input.content);
  if (!sheets) return emptyOutput("deterministico", "Não foi possível ler o ficheiro Excel.");

  const diretas: VendaLinha[] = [];
  const indiretas: VendaLinha[] = [];
  for (const s of sheets) {
    const linhas = readVendas(s);
    if (norm(s.name).includes("indiret")) indiretas.push(...linhas);
    else diretas.push(...linhas);
  }
  if (diretas.length === 0 && indiretas.length === 0) {
    return emptyOutput("deterministico", "Cabeçalhos do mapa de vendas não reconhecidos.");
  }

  const campos: ExtractedField[] = [];
  if (diretas.length) {
    campos.push({
      section: "mercado_linhas",
      key: "vendas_por_mercado",
      label: "Vendas por mercado/produto",
      value: { linhas: diretas },
      confianca: null,
    });
  }
  if (indiretas.length) {
    campos.push({
      section: "exportacoes_indiretas",
      key: "exportacoes_indiretas",
      label: "Exportações indiretas",
      value: { linhas: indiretas },
      confianca: null,
    });
  }
  return { metodo: "deterministico", confianca: null, campos, nota: null };
}

/**
 * Motor determinístico para Mapas da Segurança Social / quadro de pessoal.
 * Conta os trabalhadores (linhas de dados) e, se existir, lê a coluna de ETI.
 */
export async function extractQuadroPessoal(input: ExtractInput): Promise<ExtractorOutput> {
  if (!looksLikeXlsx(input.content, input.mimeType)) {
    return emptyOutput("deterministico", "Quadro de pessoal não está em formato Excel.");
  }
  const sheets = await readSheets(input.content);
  if (!sheets) return emptyOutput("deterministico", "Não foi possível ler o ficheiro Excel.");

  const sheet = sheets[0];
  if (!sheet) return emptyOutput("deterministico", "Ficheiro Excel sem folhas.");
  // cabeçalho: linha com "nome"/"trabalhador" ou "nif"
  const headerIdx = sheet.rows.findIndex((r) =>
    r.some((c) => ["nome", "trabalhador", "nif", "colaborador"].some((s) => norm(c).includes(s))),
  );
  const headerRow = headerIdx >= 0 ? sheet.rows[headerIdx] : undefined;
  if (!headerRow) return emptyOutput("deterministico", "Quadro de pessoal sem cabeçalho reconhecível.");

  const etiCol = matchCol(headerRow, ["eti", "tempo completo", "equivalente"]);
  let trabalhadores = 0;
  let eti = 0;
  for (let i = headerIdx + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (!row) continue;
    const hasName = row.some((c) => typeof c === "string" && norm(c).length > 1);
    if (!hasName) continue;
    trabalhadores += 1;
    if (etiCol >= 0) {
      const v = toNumber(row[etiCol] ?? null);
      if (v != null) eti += v;
    }
  }
  if (trabalhadores === 0) return emptyOutput("deterministico", "Sem linhas de pessoal.");

  const campos: ExtractedField[] = [
    {
      section: "beneficiario",
      key: "n_trabalhadores",
      label: "N.º de trabalhadores",
      value: trabalhadores,
      confianca: null,
    },
  ];
  if (etiCol >= 0 && eti > 0) {
    campos.push({
      section: "beneficiario",
      key: "eti",
      label: "Postos de trabalho (ETI)",
      value: Math.round(eti * 100) / 100,
      confianca: null,
    });
  }
  return { metodo: "deterministico", confianca: null, campos, nota: null };
}
