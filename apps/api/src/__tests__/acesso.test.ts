import { describe, expect, it } from "vitest";
import { sugerirCondicaoAcesso, verificarCondicaoAcesso, type AvisoElegibilidade } from "@estrategor/shared";

const ELIG: AvisoElegibilidade = {
  caeElegiveis: ["26110", "28290", "62"],
  nuts2Elegiveis: ["Norte", "Centro"],
  exigeBaixaDensidade: true,
  naturezasElegiveis: ["LDA"],
  estado: "validado",
};

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

describe("verificação determinística com elegibilidade do aviso (TRNSF-1030)", () => {
  it("CAE coberto por prefixo (62 cobre 62010) → provável PASSA", () => {
    const s = verificarCondicaoAcesso("CAE elegível", { cae: "62010 — Programação" }, ELIG, null);
    expect(s?.sugestao).toBe("provavel_passa");
  });

  it("CAE fora da lista → provável FALHA", () => {
    const s = verificarCondicaoAcesso("CAE elegível", { cae: "74900 — Consultoria" }, ELIG, null);
    expect(s?.sugestao).toBe("provavel_falha");
  });

  it("região NUTS II elegível → provável PASSA; não elegível → FALHA", () => {
    expect(verificarCondicaoAcesso("Localização / região", {}, ELIG, { nuts2: "Norte", baixaDensidade: true })?.sugestao).toBe("provavel_passa");
    expect(verificarCondicaoAcesso("Localização / região", {}, ELIG, { nuts2: "Algarve", baixaDensidade: false })?.sugestao).toBe("provavel_falha");
  });

  it("baixa densidade exigida → PASSA/FALHA conforme o concelho", () => {
    expect(verificarCondicaoAcesso("Território de baixa densidade", {}, ELIG, { nuts2: "Norte", baixaDensidade: true })?.sugestao).toBe("provavel_passa");
    expect(verificarCondicaoAcesso("Território de baixa densidade", {}, ELIG, { nuts2: "Norte", baixaDensidade: false })?.sugestao).toBe("provavel_falha");
  });

  it("elegibilidade só 'por_validar' → não decide (recai no indício/sem dados)", () => {
    const porValidar: AvisoElegibilidade = { ...ELIG, estado: "por_validar" };
    const s = verificarCondicaoAcesso("CAE elegível", { cae: "62010" }, porValidar, null);
    expect(s?.sugestao).not.toBe("provavel_passa");
    expect(s?.sugestao).not.toBe("provavel_falha");
  });

  it("sem elegibilidade → comporta-se como a pré-análise textual (1029)", () => {
    const s = verificarCondicaoAcesso("CAE elegível", { cae: "62010" }, null, null);
    expect(s?.sugestao).toBe("indicio");
  });
});
