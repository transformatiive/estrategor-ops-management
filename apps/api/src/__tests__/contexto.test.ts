import { describe, expect, it } from "vitest";
import { assembleContexto, CAND_CONTEXT_KIND_LABELS } from "@estrategor/shared";

describe("assembleContexto — fontes de contexto da Preparação (TRNSF-1068)", () => {
  it("monta um bloco por fonte com o rótulo do tipo + label e o conteúdo", () => {
    const out = assembleContexto([
      { kind: "email", label: "Email do cliente", content: "Olá, segue a descrição do projeto." },
      { kind: "precedente", label: "Memória 2024", content: "Projeto anterior de internacionalização." },
    ]);
    expect(out).toContain(`### ${CAND_CONTEXT_KIND_LABELS.email} — Email do cliente`);
    expect(out).toContain("Olá, segue a descrição do projeto.");
    expect(out).toContain(`### ${CAND_CONTEXT_KIND_LABELS.precedente} — Memória 2024`);
    expect(out).toContain("Projeto anterior de internacionalização.");
  });

  it("respeita o orçamento de caracteres, truncando a fonte que não cabe", () => {
    const big = "x".repeat(1000);
    const out = assembleContexto([{ kind: "texto", label: "Grande", content: big }], 200);
    expect(out.length).toBeLessThanOrEqual(202);
    expect(out.endsWith("…")).toBe(true);
  });

  it("ignora fontes que já não cabem no orçamento", () => {
    const out = assembleContexto(
      [
        { kind: "texto", label: "Primeira", content: "a".repeat(150) },
        { kind: "texto", label: "Segunda", content: "b".repeat(150) },
      ],
      160,
    );
    expect(out).toContain("Primeira");
    expect(out).not.toContain("Segunda");
  });

  it("devolve vazio quando não há fontes", () => {
    expect(assembleContexto([])).toBe("");
  });
});
