import { describe, expect, it } from "vitest";
import {
  CAND_COMMON_SECTIONS,
  CAND_FAMILIES_V0,
  isFieldFinal,
  requiresHumanValidation,
} from "@estrategor/shared";

describe("proveniência por campo (TRNSF-942)", () => {
  it("extraido e gerado exigem validação humana", () => {
    expect(requiresHumanValidation("extraido")).toBe(true);
    expect(requiresHumanValidation("gerado")).toBe(true);
    expect(requiresHumanValidation("intake")).toBe(false);
    expect(requiresHumanValidation("calculado")).toBe(false);
  });

  it("extraido/gerado só é final quando validado ou corrigido", () => {
    expect(isFieldFinal("extraido", "por_validar")).toBe(false);
    expect(isFieldFinal("gerado", "por_validar")).toBe(false);
    expect(isFieldFinal("extraido", "validado")).toBe(true);
    expect(isFieldFinal("gerado", "corrigido")).toBe(true);
  });

  it("intake/calculado são finais mesmo por validar", () => {
    expect(isFieldFinal("intake", "por_validar")).toBe(true);
    expect(isFieldFinal("calculado", "por_validar")).toBe(true);
  });
});

describe("catálogo de secções comuns", () => {
  it("tem as 12 secções comuns do núcleo", () => {
    expect(CAND_COMMON_SECTIONS.length).toBe(12);
    const keys = CAND_COMMON_SECTIONS.map((s) => s.key);
    expect(keys).toContain("beneficiario");
    expect(keys).toContain("financeiro");
    expect(keys).toContain("enquadramento_tematico");
  });

  it("v0 oferece apenas as duas famílias (sem qualificacao)", () => {
    expect(CAND_FAMILIES_V0).toEqual(["inovacao_produtiva", "internacionalizacao"]);
  });
});
