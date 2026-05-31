import { describe, expect, it } from "vitest";
import {
  QUALIFICACAO_MPR_2025_2,
  computeMerit,
  resumoVerificacao,
  type VerificacaoDTO,
} from "@estrategor/shared";

describe("cálculo de mérito determinístico (TRNSF-946)", () => {
  it("sem selecções → MP parcial e subcritérios em falta", () => {
    const r = computeMerit(QUALIFICACAO_MPR_2025_2, {}, QUALIFICACAO_MPR_2025_2.regiao);
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.passes).toBe(false);
    expect(r.criteria.length).toBeGreaterThan(0);
  });

  it("é determinístico: a mesma selecção dá o mesmo MP", () => {
    // escolhe a primeira opção de cada subcritério disponível
    const sel: Record<string, number> = {};
    for (const c of QUALIFICACAO_MPR_2025_2.criterios) {
      for (const s of c.subcriterios) sel[s.codigo] = 0;
    }
    const a = computeMerit(QUALIFICACAO_MPR_2025_2, sel, QUALIFICACAO_MPR_2025_2.regiao);
    const b = computeMerit(QUALIFICACAO_MPR_2025_2, sel, QUALIFICACAO_MPR_2025_2.regiao);
    expect(a.mp).toBe(b.mp);
    expect(typeof a.mp).toBe("number");
  });
});

describe("resumo da verificação", () => {
  it("conta erros e avisos", () => {
    const dto: VerificacaoDTO = {
      resultado: "nao_conforme",
      naoConformidades: [
        { eixo: "formulario", gravidade: "erro", mensagem: "x", seccao: "a" },
        { eixo: "coerencia", gravidade: "erro", mensagem: "y", seccao: "b" },
        { eixo: "merito", gravidade: "aviso", mensagem: "z", seccao: "c" },
      ],
      mpPrevisto: 3.2,
      mpMinimo: 3,
      atingeMinimo: true,
      mpPorCriterio: [],
      criadoEm: new Date().toISOString(),
    };
    expect(resumoVerificacao(dto)).toBe("2 não-conformidade(s), 1 aviso(s)");
  });
});
