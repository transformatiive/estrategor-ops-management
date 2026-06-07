import { describe, expect, it } from "vitest";
import { extrairElegibilidadeDoAviso, normalizarNuts2 } from "../extraction/aviso.js";

describe("normalizarNuts2 (TRNSF-1032)", () => {
  it("mapeia variantes para o nome canónico NUTS II", () => {
    expect(normalizarNuts2("Norte")).toBe("Norte");
    expect(normalizarNuts2("NORTE")).toBe("Norte");
    expect(normalizarNuts2("Lisboa")).toBe("Área Metropolitana de Lisboa");
    expect(normalizarNuts2("Açores")).toBe("Região Autónoma dos Açores");
  });

  it("devolve null para regiões desconhecidas (não inventa)", () => {
    expect(normalizarNuts2("Galiza")).toBeNull();
    expect(normalizarNuts2("")).toBeNull();
  });
});

describe("extrairElegibilidadeDoAviso — guardas (sem rede/IA)", () => {
  it("URL inválido → rascunho por_validar e listas vazias (nada inventado)", async () => {
    const { proposta, nota } = await extrairElegibilidadeDoAviso("não-é-url");
    expect(proposta.estado).toBe("por_validar");
    expect(proposta.caeElegiveis).toEqual([]);
    expect(proposta.nuts2Elegiveis).toEqual([]);
    expect(nota).toMatch(/inválido/i);
  });
});
