import { describe, expect, it } from "vitest";
import { TIPOLOGIAS, validarLimiares, type TipologiaLinha } from "@estrategor/shared";

describe("tipologias de investimento (TRNSF-955)", () => {
  it("tem as 4 tipologias", () => {
    expect(TIPOLOGIAS).toEqual(["novo_estab", "aumento_capacidade", "diversificacao", "alteracao_processo"]);
  });

  it("aumento de capacidade < 20% é assinalado", () => {
    const l: TipologiaLinha = { id: "1", tipo: "aumento_capacidade", dados: { capacidade_pre: 100, capacidade_pos: 110 } };
    expect(validarLimiares(l).length).toBe(1);
  });

  it("aumento de capacidade ≥ 20% passa", () => {
    const l: TipologiaLinha = { id: "1", tipo: "aumento_capacidade", dados: { capacidade_pre: 100, capacidade_pos: 130 } };
    expect(validarLimiares(l)).toHaveLength(0);
  });

  it("diversificação exige investimento ≥ 200% dos ativos reutilizados", () => {
    const baixo: TipologiaLinha = { id: "1", tipo: "diversificacao", dados: { valor_ativos_reutilizados: 100, valor_investimento: 150 } };
    const ok: TipologiaLinha = { id: "2", tipo: "diversificacao", dados: { valor_ativos_reutilizados: 100, valor_investimento: 250 } };
    expect(validarLimiares(baixo).length).toBe(1);
    expect(validarLimiares(ok)).toHaveLength(0);
  });

  it("novo estabelecimento não tem limiar", () => {
    expect(validarLimiares({ id: "1", tipo: "novo_estab", dados: {} })).toHaveLength(0);
  });
});
