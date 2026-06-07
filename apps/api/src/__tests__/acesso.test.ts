import { describe, expect, it } from "vitest";
import { sugerirCondicaoAcesso } from "@estrategor/shared";

describe("pré-análise das condições de acesso (TRNSF-1029)", () => {
  it("localização com sede recolhida → indício com a localização", () => {
    const s = sugerirCondicaoAcesso("Localização: estabelecimento; território de baixa densidade", {
      concelho: "Oeiras",
      distrito: "Lisboa",
    });
    expect(s?.sugestao).toBe("indicio");
    expect(s?.nota).toContain("Oeiras");
    expect(s?.nota).toContain("Lisboa");
  });

  it("localização sem dados → sem_dados", () => {
    const s = sugerirCondicaoAcesso("Localização do estabelecimento", {});
    expect(s?.sugestao).toBe("sem_dados");
  });

  it("CAE com valor → indício com o CAE", () => {
    const s = sugerirCondicaoAcesso("CAE elegível", { cae: "74900 — Consultoria" });
    expect(s?.sugestao).toBe("indicio");
    expect(s?.nota).toContain("74900");
  });

  it("escalão PME → sem_dados (linha vermelha), com indício pela atividade", () => {
    const s = sugerirCondicaoAcesso("PME com contabilidade organizada", { setor: "Consultoria técnica" });
    expect(s?.sugestao).toBe("sem_dados");
    expect(s?.nota).toContain("IAPMEI");
    expect(s?.nota).toContain("Consultoria técnica");
  });

  it("autonomia financeira → sem_dados (IES)", () => {
    const s = sugerirCondicaoAcesso("Autonomia financeira (Anexo III REITD)", {});
    expect(s?.sugestao).toBe("sem_dados");
    expect(s?.nota).toContain("IES");
  });

  it("situação regularizada AT/SS → sem_dados (certidões)", () => {
    const s = sugerirCondicaoAcesso("Situação regularizada AT e Segurança Social", {});
    expect(s?.sugestao).toBe("sem_dados");
  });

  it("condição sem dados relevantes (DNSH) → sem sugestão (manual)", () => {
    expect(sugerirCondicaoAcesso("Princípio DNSH (não prejudicar significativamente)", { cae: "74900" })).toBeNull();
  });

  it("nunca devolve um estado PASSA/FALHA (não decide elegibilidade)", () => {
    const s = sugerirCondicaoAcesso("CAE elegível", { cae: "74900" });
    expect(["indicio", "sem_dados"]).toContain(s?.sugestao);
  });
});
