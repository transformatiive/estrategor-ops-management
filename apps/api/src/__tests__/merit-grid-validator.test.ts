import { describe, expect, it } from "vitest";
import {
  QUALIFICACAO_MPR_2025_2,
  parseMeritGrid,
  type MeritGridData,
} from "@estrategor/shared";

describe("parseMeritGrid (TRNSF-1038)", () => {
  it("aceita a grelha real completa (QUALIFICACAO_MPR_2025_2)", () => {
    const r = parseMeritGrid(QUALIFICACAO_MPR_2025_2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.criterios.length).toBe(4);
      // mantém a matriz regional de A.1 e as fórmulas internas
      expect(
        r.data.criterios[0]!.subcriterios[0]!.regionalOptions,
      ).toBeDefined();
      expect(r.data.criterios[1]!.formula).toContain("B.1");
    }
  });

  it("rejeita grelha sem critérios", () => {
    const grid = { ...QUALIFICACAO_MPR_2025_2, criterios: [] };
    const r = parseMeritGrid(grid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/critério/i);
  });

  it("rejeita subcritério sem opções nem matriz regional", () => {
    const grid: MeritGridData = {
      ...QUALIFICACAO_MPR_2025_2,
      criterios: [
        {
          codigo: "A",
          nome: "X",
          peso: 1,
          subcriterios: [{ codigo: "A.1", nome: "Y" }],
        },
      ],
    };
    const r = parseMeritGrid(grid);
    expect(r.ok).toBe(false);
  });

  it("rejeita fórmula MP com formato inválido", () => {
    const grid = { ...QUALIFICACAO_MPR_2025_2, formula_mp: "A mais B" };
    const r = parseMeritGrid(grid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fórmula/i);
  });

  it("rejeita pts não numérico numa opção", () => {
    const grid = JSON.parse(
      JSON.stringify(QUALIFICACAO_MPR_2025_2),
    ) as MeritGridData;
    // injeta um pts inválido
    (
      grid.criterios[1]!.subcriterios[0]!.options![0]! as unknown as {
        pts: unknown;
      }
    ).pts = "alto";
    const r = parseMeritGrid(grid);
    expect(r.ok).toBe(false);
  });
});
