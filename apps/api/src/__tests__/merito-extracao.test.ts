import { describe, expect, it } from "vitest";
import type { MeritGridData } from "@estrategor/shared";
import { normalizarPropostaMerito } from "../extraction/merito.js";

/** Grelha mínima: B.1 (opções fixas) + A.1 (matriz regional). */
const GRID: MeritGridData = {
  programa: "PT2030",
  medida: "Teste",
  codigo_aviso: "T-1",
  regiao: null,
  versao: "v1",
  escala: { min: 1, max: 5, descritores: {} },
  mp_minimo: 3,
  minimo_por_criterio: 3,
  formula_mp: "0.5*A + 0.5*B",
  criterios: [
    {
      codigo: "A",
      nome: "Estratégia",
      peso: 0.5,
      subcriterios: [
        {
          codigo: "A.1",
          nome: "RIS3",
          regionalOptions: {
            Norte: [
              { label: "Sem enquadramento", pts: 1 },
              { label: "Enquadrado", pts: 3 },
            ],
          },
        },
      ],
    },
    {
      codigo: "B",
      nome: "Qualidade",
      peso: 0.5,
      subcriterios: [
        {
          codigo: "B.1",
          nome: "Plano",
          options: [
            { label: "Muito bom", pts: 5 },
            { label: "Suficiente", pts: 3 },
            { label: "Insuficiente", pts: 1 },
          ],
        },
      ],
    },
  ],
};

describe("normalizarPropostaMerito (TRNSF-1039)", () => {
  it("mantém só a escolha válida; descarta índice fora de alcance e subcritério desconhecido", () => {
    const raw = {
      escolhas: [
        { subcriterio: "B.1", indice: 0, justificacao: "Plano coerente e detalhado." }, // válida
        { subcriterio: "B.1", indice: 9, justificacao: "índice inválido" }, // fora de alcance
        { subcriterio: "Z.9", indice: 0, justificacao: "subcritério inexistente" }, // desconhecido
      ],
      nota: "Proposta de teste.",
    };

    const out = normalizarPropostaMerito(GRID, raw, null);

    // só B.1 sobrevive (a 2ª escolha de B.1 é descartada por índice inválido)
    expect(out.selection).toEqual({ "B.1": 0 });
    expect(out.justificacoes).toEqual({ "B.1": "Plano coerente e detalhado." });
    expect(out.nota).toContain("descartada");
  });

  it("respeita a matriz regional: A.1 só é aceite com a região resolvida", () => {
    const raw = { escolhas: [{ subcriterio: "A.1", indice: 1, justificacao: "Enquadrado na S3 Norte." }], nota: "" };

    // sem região → A.1 não tem opções resolvidas → descartado
    expect(normalizarPropostaMerito(GRID, raw, null).selection).toEqual({});

    // com região Norte → aceite
    const comRegiao = normalizarPropostaMerito(GRID, raw, "Norte");
    expect(comRegiao.selection).toEqual({ "A.1": 1 });
    expect(comRegiao.justificacoes["A.1"]).toBe("Enquadrado na S3 Norte.");
  });

  it("sem escolhas válidas → proposta vazia com nota (nunca inventa)", () => {
    const out = normalizarPropostaMerito(GRID, { escolhas: [], nota: "" }, null);
    expect(out.selection).toEqual({});
    expect(out.justificacoes).toEqual({});
    expect(out.nota.length).toBeGreaterThan(0);
  });

  it("é robusto a JSON malformado (escolhas ausentes)", () => {
    const out = normalizarPropostaMerito(GRID, { foo: "bar" }, null);
    expect(out.selection).toEqual({});
  });
});
