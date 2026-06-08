import { describe, expect, it } from "vitest";
import {
  QUALIFICACAO_MPR_2025_2,
  computeMerit,
  type MeritSelection,
} from "@estrategor/shared";

/**
 * Regressão do "score instável" (3.84 ↔ 2.93): o MP só pode mudar com ação
 * explícita do consultor. A causa era a região (e a grelha) não ficarem fixadas
 * — a mesma seleção resolvia para pontuações diferentes consoante a região
 * inferida na leitura. Estes testes travam o contrato do motor puro em que a
 * correção (fixar grelha+região no diagnóstico) assenta.
 */
const grid = QUALIFICACAO_MPR_2025_2;

// Seleção completa, escolhendo para cada subcritério a 1.ª opção da matriz da
// região "Centro" (A.1 é regional; os restantes são iguais entre regiões).
function selecaoCentro(): MeritSelection {
  const sel: MeritSelection = {};
  for (const crit of grid.criterios) {
    for (const sub of crit.subcriterios) {
      const opts = sub.options ?? sub.regionalOptions?.["Centro"] ?? [];
      if (opts.length > 0) sel[sub.codigo] = 0;
    }
  }
  return sel;
}

describe("mérito — fixação da grelha/região (regressão do score instável)", () => {
  it("é determinístico: mesma grelha+seleção+região → MP idêntico", () => {
    const sel = selecaoCentro();
    const a = computeMerit(grid, sel, "Centro");
    const b = computeMerit(grid, sel, "Centro");
    expect(a.mp).toBe(b.mp);
    expect(a.missing).toEqual(b.missing);
  });

  it("a região afeta a resolução: a MESMA seleção sem região deixa A.1 por resolver", () => {
    const sel = selecaoCentro();
    const comRegiao = computeMerit(grid, sel, "Centro");
    const semRegiao = computeMerit(grid, sel, null);
    // Com região, A.1 (regional) resolve; sem região fica em falta — logo o
    // resultado muda. É exatamente o drift que a fixação da região evita.
    expect(comRegiao.missing).not.toContain("A.1");
    expect(semRegiao.missing).toContain("A.1");
    expect(comRegiao.mp).not.toBe(semRegiao.mp);
  });
});
