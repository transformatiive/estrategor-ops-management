import { RUBRICAS_SNC, type ExtractedField } from "@estrategor/shared";
import { extractPdfText, looksLikePdf } from "../ai/pdf.js";
import { readSheets, looksLikeXlsx, toNumber } from "./xlsx.js";
import { emptyOutput, type ExtractInput, type ExtractorOutput } from "./types.js";

/** Uma linha candidata a rubrica: rótulo legível + os números encontrados. */
interface ParsedRow {
  label: string;
  numbers: number[];
}

/** Deteta anos (2000–2099) numa lista de números. */
function yearsFromNumbers(nums: number[]): number[] {
  return nums.filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2099);
}

/** Extrai os tokens numéricos de uma linha de texto (formato PT). */
function numbersFromText(line: string): number[] {
  const tokens = line.match(/-?\d[\d.]*(?:,\d+)?/g) ?? [];
  return tokens.map((t) => toNumber(t)).filter((n): n is number => n != null);
}

/** Constrói as linhas candidatas a partir de XLSX (células) ou texto (linhas). */
async function buildRows(input: ExtractInput): Promise<ParsedRow[] | null> {
  if (looksLikeXlsx(input.content, input.mimeType)) {
    const sheets = await readSheets(input.content);
    if (!sheets) return null;
    const rows: ParsedRow[] = [];
    for (const s of sheets) {
      for (const r of s.rows) {
        const labelParts = r.filter((c) => typeof c === "string") as string[];
        const numbers = r.map((c) => toNumber(c)).filter((n): n is number => n != null);
        if (labelParts.length || numbers.length) rows.push({ label: labelParts.join(" ").trim(), numbers });
      }
    }
    return rows;
  }
  if (looksLikePdf(input.content) || input.mimeType.startsWith("text/")) {
    const text = looksLikePdf(input.content)
      ? await extractPdfText(input.content, 20000)
      : input.content.toString("utf8").slice(0, 20000);
    if (!text.trim()) return null;
    return text
      .split(/\r?\n/)
      .map((l) => ({ label: l.trim(), numbers: numbersFromText(l) }))
      .filter((r) => r.label.length > 0);
  }
  return null;
}

/** Detecta a sequência de anos do mapa, lendo a linha de cabeçalho. */
function detectYears(rows: ParsedRow[]): number[] {
  for (const r of rows) {
    const ys = yearsFromNumbers(r.numbers);
    if (ys.length >= 1 && ys.length === r.numbers.length) return ys.slice(0, 3);
  }
  // sem cabeçalho explícito → anos por descobrir; usamos índices posicionais
  return [];
}

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Motor determinístico para IES / Modelo 22 / balancetes (estrutura SNC). Lê
 * ficheiros estruturados COM CÓDIGO (sem IA), reconhecendo as rubricas pelo
 * código de conta SNC ou pela designação (catálogo TRNSF-953). Devolve a
 * componente financeira como uma tabela (balanço + DR por ano). Se não
 * reconhecer estrutura suficiente, devolve vazio e o motor cai para a IA.
 */
export async function extractSnc(input: ExtractInput): Promise<ExtractorOutput> {
  const rows = await buildRows(input);
  if (!rows || rows.length === 0) return emptyOutput("deterministico", "Ficheiro sem texto/estrutura legível.");

  const anos = detectYears(rows);
  const linhas: { tipo: string; codigo: string; designacao: string; valores: Record<string, number> }[] = [];

  for (const rub of RUBRICAS_SNC) {
    const codeRe = new RegExp(`(^|\\D)${reEsc(rub.codigo)}(\\D|$)`);
    const desNorm = rub.designacao
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const match = rows.find((r) => {
      const labelNorm = r.label
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      const byCode = codeRe.test(r.label) && r.numbers.some((n) => !yearsFromNumbers([n]).length);
      const byName = labelNorm.includes(desNorm);
      return (byCode || byName) && r.numbers.length > 0;
    });
    if (!match) continue;

    // valores = números que não são anos, alinhados às colunas de ano detetadas
    const vals = match.numbers.filter((n) => !(Number.isInteger(n) && n >= 2000 && n <= 2099));
    // remove o próprio código de conta, que surge como token numérico na linha
    const codeNum = Number(rub.codigo);
    if (Number.isFinite(codeNum)) {
      const idx = vals.indexOf(codeNum);
      if (idx >= 0) vals.splice(idx, 1);
    }
    if (vals.length === 0) continue;
    const valores: Record<string, number> = {};
    vals.forEach((v, i) => {
      const ano = anos[i] != null ? String(anos[i]) : `col${i + 1}`;
      valores[ano] = v;
    });
    linhas.push({ tipo: rub.tipo, codigo: rub.codigo, designacao: rub.designacao, valores });
  }

  if (linhas.length === 0) {
    return emptyOutput("deterministico", "Estrutura SNC não reconhecida no ficheiro.");
  }

  const campos: ExtractedField[] = [
    {
      section: "financeiro",
      key: "demonstracoes_financeiras",
      label: "Demonstrações financeiras (balanço + DR por ano)",
      value: { anos, linhas },
      confianca: null,
    },
  ];

  // Derivado determinístico: volume de negócios (Vendas 71 + Prestações 72) no
  // ano mais recente detetado.
  const anoRef = anos.length ? String(Math.max(...anos)) : null;
  if (anoRef) {
    const vendas = linhas.find((l) => l.codigo === "71")?.valores[anoRef] ?? 0;
    const prest = linhas.find((l) => l.codigo === "72")?.valores[anoRef] ?? 0;
    if (vendas || prest) {
      campos.push({
        section: "financeiro",
        key: "volume_negocios",
        label: `Volume de negócios (${anoRef})`,
        value: vendas + prest,
        confianca: null,
      });
    }
  }

  return { metodo: "deterministico", confianca: null, campos, nota: null };
}
