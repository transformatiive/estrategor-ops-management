import { describe, expect, it } from "vitest";
import {
  anoDe,
  totaisPorAno,
  totaisPorCategoria,
  totalElegivel,
  type InvestimentoLinha,
} from "@estrategor/shared";

const linhas: InvestimentoLinha[] = [
  { id: "1", designacao: "Máquina A", categoria: "MAQUINAS", dataAquisicao: "2024-03", elegivel: 100000, ef: true },
  { id: "2", designacao: "Máquina B", categoria: "MAQUINAS", dataAquisicao: "2025-06", elegivel: 50000, ef: false },
  { id: "3", designacao: "Software", categoria: "SOFTWARE", dataAquisicao: "2024-09", elegivel: 30000, ef: true },
  { id: "4", designacao: "Estudo", categoria: "ESTUDOS_DNSH", dataAquisicao: null, elegivel: 5000, ef: false },
];

describe("custos / investimentos (TRNSF-945)", () => {
  it("extrai o ano de aaaa-mm", () => {
    expect(anoDe("2024-03")).toBe(2024);
    expect(anoDe("2024")).toBeNull();
    expect(anoDe(null)).toBeNull();
  });

  it("soma o total elegível", () => {
    expect(totalElegivel(linhas)).toBe(185000);
  });

  it("agrega por categoria", () => {
    const t = totaisPorCategoria(linhas);
    expect(t.MAQUINAS).toBe(150000);
    expect(t.SOFTWARE).toBe(30000);
    expect(t.ESTUDOS_DNSH).toBe(5000);
  });

  it("agrega por ano (sem data → sem_data)", () => {
    const t = totaisPorAno(linhas);
    expect(t["2024"]).toBe(130000); // 100000 + 30000
    expect(t["2025"]).toBe(50000);
    expect(t.sem_data).toBe(5000);
  });
});
