import { describe, expect, it } from "vitest";
import {
  DOCUMENT_TAXONOMY,
  documentTypesForProgram,
} from "@estrategor/shared";

describe("documentTypesForProgram", () => {
  it("inclui os documentos comuns (appliesTo: all) em qualquer programa", () => {
    const sifide = documentTypesForProgram("SIFIDE");
    expect(sifide.some((d) => d.key === "CERTIDAO_PERMANENTE")).toBe(true);
    expect(sifide.some((d) => d.key === "IES")).toBe(true);
  });

  it("exclui documentos específicos de PT2030 noutros programas", () => {
    const sifide = documentTypesForProgram("SIFIDE");
    expect(sifide.some((d) => d.key === "LICENCIAMENTOS")).toBe(false);
    expect(sifide.some((d) => d.key === "TURISMO_MEMORIA")).toBe(false);
  });

  it("PT2030 inclui mais tipos do que SIFIDE", () => {
    const pt2030 = documentTypesForProgram("PT2030");
    const sifide = documentTypesForProgram("SIFIDE");
    expect(pt2030.length).toBeGreaterThan(sifide.length);
  });

  it("todos os tipos têm uma pasta-alvo definida", () => {
    for (const d of DOCUMENT_TAXONOMY) {
      expect(d.targetFolder.length).toBeGreaterThan(0);
    }
  });
});
