import { describe, expect, it } from "vitest";
import {
  ANEXOS,
  CATEGORIAS_CUSTO,
  DOMINIOS_INTL,
  INDICADORES,
} from "@estrategor/shared";

describe("rulebook / catálogos (TRNSF-953)", () => {
  it("domínios de internacionalização são 1..6 sem buracos", () => {
    expect(DOMINIOS_INTL.map((d) => d.numero)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("indicadores incluem os códigos oficiais do ticket", () => {
    const codes = INDICADORES.map((i) => i.codigo);
    for (const c of ["RPO008", "RCR01", "RPR003", "RSR23", "RPR001", "RPR031", "RPR002", "RPR080", "RPA001"]) {
      expect(codes).toContain(c);
    }
  });

  it("categorias de custo existem para ambas as famílias", () => {
    expect(CATEGORIAS_CUSTO.some((c) => c.familia === "inovacao_produtiva")).toBe(true);
    expect(CATEGORIAS_CUSTO.some((c) => c.familia === "internacionalizacao")).toBe(true);
  });

  it("anexos cobrem os 3 níveis para a Família A", () => {
    const a = ANEXOS.filter((x) => x.familia === "inovacao_produtiva");
    expect(a.some((x) => x.nivel === "transversal")).toBe(true);
    expect(a.some((x) => x.nivel === "tipologia")).toBe(true);
    expect(a.some((x) => x.nivel === "condicional")).toBe(true);
  });

  it("códigos de categoria de custo são únicos por família", () => {
    const seen = new Set<string>();
    for (const c of CATEGORIAS_CUSTO) {
      const key = `${c.familia}:${c.codigo}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
