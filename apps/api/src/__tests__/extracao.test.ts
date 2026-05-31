import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { EXTRACTOR_TARGETS, extractorFor, hasExtractor } from "@estrategor/shared";
import { extractSnc } from "../extraction/snc.js";
import { extractMapaVendas, extractQuadroPessoal } from "../extraction/excel.js";
import { toNumber } from "../extraction/xlsx.js";
import type { ExtractInput } from "../extraction/types.js";

function textInput(tipo: string, text: string): ExtractInput {
  return {
    documentId: "d1",
    tipoDocumento: tipo,
    filename: "ficheiro.txt",
    mimeType: "text/plain",
    content: Buffer.from(text, "utf8"),
  };
}

async function xlsxInput(tipo: string, build: (wb: ExcelJS.Workbook) => void): Promise<ExtractInput> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return {
    documentId: "d1",
    tipoDocumento: tipo,
    filename: "mapa.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: Buffer.from(buf),
  };
}

describe("mapeamento documento → campos (TRNSF-952)", () => {
  it("cobre os tipos do ticket", () => {
    for (const k of ["IES", "MODELO_22", "MAPA_VENDAS", "MAPAS_SEG_SOCIAL", "CERTIDAO_PERMANENTE", "RCBE", "INTENCOES_INVESTIMENTO"]) {
      expect(hasExtractor(k)).toBe(true);
    }
    expect(hasExtractor("LICENCIAMENTOS")).toBe(false);
  });

  it("IES/MODELO_22 são determinísticos; certidão/RCBE/orçamentos são IA", () => {
    expect(extractorFor("IES")?.metodo).toBe("deterministico");
    expect(extractorFor("MAPA_VENDAS")?.metodo).toBe("deterministico");
    expect(extractorFor("CERTIDAO_PERMANENTE")?.metodo).toBe("ia");
    expect(extractorFor("INTENCOES_INVESTIMENTO")?.metodo).toBe("ia");
  });

  it("cada alvo aponta para secções da candidatura", () => {
    for (const t of EXTRACTOR_TARGETS) expect(t.secoes.length).toBeGreaterThan(0);
  });
});

describe("conversão numérica PT", () => {
  it("trata milhares e decimais", () => {
    expect(toNumber("1.234.567,89")).toBe(1234567.89);
    expect(toNumber("900.000,00")).toBe(900000);
    expect(toNumber("50,5")).toBe(50.5);
    expect(toNumber("12")).toBe(12);
    expect(toNumber("—")).toBeNull();
  });
});

describe("extractor determinístico SNC (IES/balancete)", () => {
  it("lê balanço/DR por ano e calcula o volume de negócios", async () => {
    const text = [
      "Rubrica 2023 2022",
      "71 Vendas 1.000.000,00 900.000,00",
      "72 Prestações de serviços 50.000,00 40.000,00",
      "63 Gastos com o pessoal 300.000,00 280.000,00",
    ].join("\n");
    const out = await extractSnc(textInput("IES", text));
    expect(out.metodo).toBe("deterministico");
    expect(out.confianca).toBeNull(); // leitura exata, sem IA

    const df = out.campos.find((c) => c.key === "demonstracoes_financeiras");
    expect(df).toBeDefined();
    const value = df!.value as { anos: number[]; linhas: { codigo: string; valores: Record<string, number> }[] };
    expect(value.anos).toEqual([2023, 2022]);
    const vendas = value.linhas.find((l) => l.codigo === "71");
    expect(vendas?.valores["2023"]).toBe(1000000);
    expect(vendas?.valores["2022"]).toBe(900000);

    const vn = out.campos.find((c) => c.key === "volume_negocios");
    expect(vn?.value).toBe(1050000); // 1.000.000 + 50.000 no ano mais recente
  });

  it("devolve vazio (→ fallback) quando não há estrutura SNC", async () => {
    const out = await extractSnc(textInput("IES", "documento sem rubricas reconhecíveis"));
    expect(out.campos).toHaveLength(0);
    expect(out.nota).toBeTruthy();
  });
});

describe("extractor determinístico de Excel", () => {
  it("lê o mapa de vendas (formato largo por ano) e separa indiretas", async () => {
    const input = await xlsxInput("MAPA_VENDAS", (wb) => {
      const ws = wb.addWorksheet("Vendas");
      ws.addRow(["Mercado", "2022", "2023"]);
      ws.addRow(["Espanha", 100000, 120000]);
      ws.addRow(["França", 50000, 60000]);
      const wi = wb.addWorksheet("Indiretas");
      wi.addRow(["Mercado", "Valor"]);
      wi.addRow(["Alemanha", 30000]);
    });
    const out = await extractMapaVendas(input);
    expect(out.metodo).toBe("deterministico");
    const diretas = out.campos.find((c) => c.key === "vendas_por_mercado");
    const indiretas = out.campos.find((c) => c.key === "exportacoes_indiretas");
    expect(diretas).toBeDefined();
    expect(indiretas).toBeDefined();
    const linhas = (diretas!.value as { linhas: unknown[] }).linhas;
    expect(linhas.length).toBe(4); // 2 mercados × 2 anos
  });

  it("conta trabalhadores no quadro de pessoal", async () => {
    const input = await xlsxInput("MAPAS_SEG_SOCIAL", (wb) => {
      const ws = wb.addWorksheet("Pessoal");
      ws.addRow(["Nome", "NIF", "ETI"]);
      ws.addRow(["Ana", "111", 1]);
      ws.addRow(["Bruno", "222", 0.5]);
      ws.addRow(["Carla", "333", 1]);
    });
    const out = await extractQuadroPessoal(input);
    const n = out.campos.find((c) => c.key === "n_trabalhadores");
    const eti = out.campos.find((c) => c.key === "eti");
    expect(n?.value).toBe(3);
    expect(eti?.value).toBe(2.5);
  });

  it("falha graciosamente em ficheiro não-Excel", async () => {
    const out = await extractMapaVendas(textInput("MAPA_VENDAS", "não é excel"));
    expect(out.campos).toHaveLength(0);
    expect(out.nota).toBeTruthy();
  });
});
