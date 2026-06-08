import { describe, expect, it } from "vitest";
import { isOpen, mapAviso, parseYmd, type Aviso2030 } from "../avisos2030/source.js";

const rawItem = {
  id: 254176,
  link: "https://portugal2030.pt/avisos/siac/",
  title: { rendered: "SIAC-Empreendedorismo Qualificado" },
  acf: {
    codigo: "FA0031/2026",
    programa: ["ALGARVE2030"],
    natureza: "Concurso",
    nuts: ["Algarve"],
    beneficiario: ["Pública | Privada"],
    tipologia_operacao: ["1022 - Ações coletivas"],
    data_inicio: "20260915",
    data_fim: "20270115",
    df: 1000000,
    comparticipacao: "70%",
    pdf: 254177,
  },
};

describe("conector avisos PT2030 (TRNSF-1072)", () => {
  it("parseYmd lê YYYYMMDD e rejeita o resto", () => {
    expect(parseYmd("20260915")?.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(parseYmd("2026-09-15")).toBeNull();
    expect(parseYmd("")).toBeNull();
    expect(parseYmd(20260915)).toBeNull();
  });

  it("mapAviso normaliza o acf do portal", () => {
    const a = mapAviso(rawItem)!;
    expect(a.externalId).toBe(254176);
    expect(a.codigo).toBe("FA0031/2026");
    expect(a.titulo).toContain("SIAC");
    expect(a.programa).toBe("ALGARVE2030");
    expect(a.nuts).toEqual(["Algarve"]);
    expect(a.dataInicio?.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(a.dataFim?.toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(a.dotacao).toBe(1000000);
    expect(a.comparticipacao).toBe("70%");
    expect(a.pdfMediaId).toBe(254177);
  });

  it("mapAviso devolve null sem id ou sem código", () => {
    expect(mapAviso({ id: 1, acf: {} })).toBeNull();
    expect(mapAviso({ acf: { codigo: "X" } })).toBeNull();
  });

  it("isOpen: fim no futuro abre, no passado fecha, sem fim é contínuo", () => {
    const base: Aviso2030 = { ...mapAviso(rawItem)! };
    const now = new Date("2026-10-01T00:00:00Z");
    expect(isOpen({ ...base, dataFim: new Date("2027-01-15") }, now)).toBe(true);
    expect(isOpen({ ...base, dataFim: new Date("2026-01-15") }, now)).toBe(false);
    expect(isOpen({ ...base, dataFim: null }, now)).toBe(true);
  });
});
