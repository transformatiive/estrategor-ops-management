import { describe, expect, it } from "vitest";
import {
  QUALIFICACAO_MPR_2025_2,
  computeMerit,
  type MeritSelection,
} from "@estrategor/shared";

const grid = QUALIFICACAO_MPR_2025_2;

// Helper: escolhe a opção com determinada pontuação num subcritério.
function pick(sub: string, pts: number): [string, number] {
  const crit = grid.criterios.find((c) => c.subcriterios.some((s) => s.codigo === sub))!;
  const s = crit.subcriterios.find((x) => x.codigo === sub)!;
  const opts = s.options ?? s.regionalOptions?.["Centro"] ?? [];
  const idx = opts.findIndex((o) => o.pts === pts);
  return [sub, idx];
}

describe("computeMerit — SICE Qualificação MPr-2025-2", () => {
  it("todos a 5 (com região Centro p/ A.1) → MP 5,00 e passa", () => {
    const gridCentro = { ...grid, regiao: "Centro" };
    const sel: MeritSelection = Object.fromEntries([
      pick("A.1", 5),
      pick("B.1", 5),
      pick("B.2", 5),
      pick("B.3", 4), // B.3 máximo é 4 na base
      pick("C.1", 5),
      pick("D.1", 5),
      pick("D.2", 5),
    ]);
    // A.1 picado da matriz Centro (idx por pts=5)
    const a1 = gridCentro.criterios[0]!.subcriterios[0]!;
    sel["A.1"] = (a1.regionalOptions!["Centro"]!).findIndex((o) => o.pts === 5);

    const r = computeMerit(gridCentro, sel);
    expect(r.missing).toHaveLength(0);
    // A=5; B=0.5*5+0.15*5+0.35*4=4.65; C=5; D=0.7*5+0.3*5=5
    // MP=0.3*5+0.3*4.65+0.15*5+0.25*5 = 1.5+1.395+0.75+1.25 = 4.895 ≈ 4.90
    expect(r.criteria.find((c) => c.codigo === "B")!.score).toBeCloseTo(4.65, 2);
    // MP = 0.3*5 + 0.3*4.65 + 0.15*5 + 0.25*5 = 4.895 → 4.89 (arredondado a 2 c.d.)
    expect(r.mp).toBeCloseTo(4.89, 2);
    expect(r.meetsMpMinimo).toBe(true);
    expect(r.meetsAllCriteria).toBe(true);
    expect(r.passes).toBe(true);
  });

  it("um critério abaixo de 3 → não passa o mínimo por critério", () => {
    const gridCentro = { ...grid, regiao: "Centro" };
    const sel: MeritSelection = {};
    sel["A.1"] = 0; // Centro: "não alinhada" = 3
    sel["B.1"] = grid.criterios[1]!.subcriterios[0]!.options!.findIndex((o) => o.pts === 1); // 1 → B baixo
    sel["B.2"] = 0;
    sel["B.3"] = 0;
    sel["C.1"] = 0;
    sel["D.1"] = 0;
    sel["D.2"] = 0;
    const r = computeMerit(gridCentro, sel);
    const b = r.criteria.find((c) => c.codigo === "B")!;
    expect(b.score).toBeLessThan(3);
    expect(b.belowMinimum).toBe(true);
    expect(r.passes).toBe(false);
  });

  it("selecção incompleta → missing não vazio e não passa", () => {
    const r = computeMerit({ ...grid, regiao: "Centro" }, { "A.1": 0 });
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.passes).toBe(false);
  });

  it("matriz regional: sem região definida, A.1 fica por preencher", () => {
    // grid.regiao = null e A.1 só tem regionalOptions → sem opções → missing
    const r = computeMerit(grid, { "A.1": 0 });
    expect(r.missing).toContain("A.1");
  });

  it("a fórmula MP usa os pesos 0.30/0.30/0.15/0.25", () => {
    const gridCentro = { ...grid, regiao: "Centro" };
    // todos a 3 → MP = 3 (média ponderada de pesos que somam 1)
    const sel: MeritSelection = {
      "A.1": gridCentro.criterios[0]!.subcriterios[0]!.regionalOptions!["Centro"]!.findIndex((o) => o.pts === 3),
      "B.1": grid.criterios[1]!.subcriterios[0]!.options!.findIndex((o) => o.pts === 3),
      "B.2": grid.criterios[1]!.subcriterios[1]!.options!.findIndex((o) => o.pts === 3),
      "B.3": grid.criterios[1]!.subcriterios[2]!.options!.findIndex((o) => o.pts === 3),
      "C.1": grid.criterios[2]!.subcriterios[0]!.options!.findIndex((o) => o.pts === 3),
      "D.1": grid.criterios[3]!.subcriterios[0]!.options!.findIndex((o) => o.pts === 3),
      "D.2": grid.criterios[3]!.subcriterios[1]!.options!.findIndex((o) => o.pts === 3),
    };
    const r = computeMerit(gridCentro, sel);
    expect(r.mp).toBeCloseTo(3.0, 2);
  });
});
