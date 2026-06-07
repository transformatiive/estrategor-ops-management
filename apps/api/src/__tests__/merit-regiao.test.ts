import { describe, expect, it } from "vitest";
import {
  QUALIFICACAO_MPR_2025_2,
  gridRegions,
  regiaoGrelhaParaNuts2,
} from "@estrategor/shared";

// Regiões reais presentes na grelha QUALIFICACAO_MPR_2025_2 (matriz A.1):
// "Centro", "Lisboa", "Alentejo", "Norte".
const regioesGrelha = gridRegions(QUALIFICACAO_MPR_2025_2);

describe("regiaoGrelhaParaNuts2 — mapeia o NUTS II da empresa à matriz da grelha", () => {
  it("AML (NUTS II) → 'Lisboa' quando a grelha tem 'Lisboa'", () => {
    expect(
      regiaoGrelhaParaNuts2("Área Metropolitana de Lisboa", regioesGrelha),
    ).toBe("Lisboa");
  });

  it("'Lisboa' → 'Lisboa' (alias aceita também a forma curta)", () => {
    expect(regiaoGrelhaParaNuts2("Lisboa", regioesGrelha)).toBe("Lisboa");
  });

  it("correspondência exata 'Centro' → 'Centro'", () => {
    expect(regiaoGrelhaParaNuts2("Centro", regioesGrelha)).toBe("Centro");
  });

  it("correspondência exata acento/caixa-insensível 'norte' → 'Norte'", () => {
    expect(regiaoGrelhaParaNuts2("norte", regioesGrelha)).toBe("Norte");
  });

  it("'Algarve' (não está na grelha QUALIFICACAO) → null", () => {
    expect(regiaoGrelhaParaNuts2("Algarve", regioesGrelha)).toBeNull();
  });

  it("nunca inventa uma região fora da grelha: AML mapeia a null se 'Lisboa' não existir", () => {
    expect(
      regiaoGrelhaParaNuts2("Área Metropolitana de Lisboa", ["Centro", "Norte"]),
    ).toBeNull();
  });

  it("input null → null", () => {
    expect(regiaoGrelhaParaNuts2(null, regioesGrelha)).toBeNull();
  });

  it("input undefined → null", () => {
    expect(regiaoGrelhaParaNuts2(undefined, regioesGrelha)).toBeNull();
  });

  it("grelha sem regiões → null", () => {
    expect(regiaoGrelhaParaNuts2("Centro", [])).toBeNull();
  });
});
