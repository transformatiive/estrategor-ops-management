import { describe, expect, it } from "vitest";
import { parseMapaInvestimentos } from "../extraction/investimentosMapa.js";
import type { SheetData } from "../extraction/xlsx.js";

const sheet = (rows: (string | number | null)[][]): SheetData => ({ name: "Mapa", rows });

describe("parseMapaInvestimentos (TRNSF-1070)", () => {
  it("reconhece o cabeçalho e extrai as linhas (designação, categoria, elegível, ano, EF)", () => {
    const s = sheet([
      ["Mapa de Investimentos"],
      ["Designação", "Categoria", "Ano", "Montante Elegível", "EF"],
      ["Torno CNC", "Equipamento", 2026, 50000, "Sim"],
      ["Software ERP", "Software", 2027, 12000, ""],
    ]);
    const { linhas, nota } = parseMapaInvestimentos([s]);
    expect(nota).toBeNull();
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ designacao: "Torno CNC", categoria: "Equipamento", elegivel: 50000, dataAquisicao: "2026-01", ef: true });
    expect(linhas[1]).toMatchObject({ designacao: "Software ERP", elegivel: 12000, ef: false });
  });

  it("ignora linhas de total e linhas sem montante", () => {
    const s = sheet([
      ["Rubrica", "Valor elegível"],
      ["Equipamento A", 1000],
      ["Linha vazia", null],
      ["TOTAL", 1000],
    ]);
    const { linhas } = parseMapaInvestimentos([s]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.designacao).toBe("Equipamento A");
  });

  it("aceita datas aaaa-mm e dd/mm/aaaa", () => {
    const s = sheet([
      ["Descrição", "Data", "Elegível"],
      ["Obra civil", "2026-05", 8000],
      ["Máquina", "15/03/2027", 9000],
    ]);
    const { linhas } = parseMapaInvestimentos([s]);
    expect(linhas[0]!.dataAquisicao).toBe("2026-05");
    expect(linhas[1]!.dataAquisicao).toBe("2027-03");
  });

  it("devolve nota quando não reconhece o cabeçalho", () => {
    const s = sheet([["foo", "bar"], ["a", "b"]]);
    const { linhas, nota } = parseMapaInvestimentos([s]);
    expect(linhas).toHaveLength(0);
    expect(nota).toBeTruthy();
  });
});
