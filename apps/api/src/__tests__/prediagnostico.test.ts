import { describe, expect, it } from "vitest";
import {
  FIELD_ORIGINS,
  FIELD_ORIGIN_LABELS,
  isFieldFinal,
  requiresHumanValidation,
} from "@estrategor/shared";

describe("proveniência do pré-diagnóstico (TRNSF-967)", () => {
  it("inclui as novas origens", () => {
    for (const o of ["oficial_vies", "api_empresas", "pre_diagnostico_ia"]) {
      expect(FIELD_ORIGINS).toContain(o);
      expect(FIELD_ORIGIN_LABELS[o as keyof typeof FIELD_ORIGIN_LABELS]).toBeTruthy();
    }
  });

  it("VIES (oficial) nasce validado e não exige validação humana", () => {
    expect(requiresHumanValidation("oficial_vies")).toBe(false);
    expect(isFieldFinal("oficial_vies", "validado")).toBe(true);
  });

  it("API empresas e IA exigem validação humana (linha vermelha)", () => {
    expect(requiresHumanValidation("api_empresas")).toBe(true);
    expect(requiresHumanValidation("pre_diagnostico_ia")).toBe(true);
    expect(isFieldFinal("api_empresas", "por_validar")).toBe(false);
    expect(isFieldFinal("pre_diagnostico_ia", "por_validar")).toBe(false);
    expect(isFieldFinal("pre_diagnostico_ia", "validado")).toBe(true);
  });
});
