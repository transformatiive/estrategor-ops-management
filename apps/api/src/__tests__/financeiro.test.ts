import { describe, expect, it } from "vitest";
import {
  computeBalancoAno,
  computeDrAno,
  computeFinanciamentoAno,
  computeIndicadores,
  gafPrePos,
  validateCoherence,
  valorRubrica,
  type FinanceiroMapas,
} from "@estrategor/shared";

function mapas(): FinanceiroMapas {
  return {
    anos: [2023, 2024],
    balanco: {
      ativo_nao_corrente: { "2023": 600, "2024": 800 },
      ativo_corrente: { "2023": 400, "2024": 200 },
      capital_realizado: { "2023": 300, "2024": 300 },
      resultado_liquido: { "2023": 100, "2024": 100 },
      passivo_nao_corrente: { "2023": 400, "2024": 300 },
      passivo_corrente: { "2023": 200, "2024": 300 },
    },
    dr: {
      vendas_servicos: { "2023": 1000 },
      subsidios_exploracao: { "2023": 100 },
      cmvmc: { "2023": 300 },
      fse: { "2023": 200 },
      gastos_pessoal: { "2023": 250 },
      imparidades: { "2023": 0 },
      depreciacoes_amortizacoes: { "2023": 50 },
      juros: { "2023": 20 },
      imposto: { "2023": 30 },
    },
    financiamento: {
      capital: { "2024": 100 },
      fin_credito: { "2024": 300 },
      inr: { "2024": 100 },
      custo_total: { "2024": 500 },
    },
  };
}

describe("componente financeira — cálculo determinístico (TRNSF-944)", () => {
  it("balanço: totais e autonomia financeira", () => {
    const b = computeBalancoAno(mapas().balanco, 2023);
    expect(b.total_ativo).toBe(1000); // 600 + 400
    expect(b.total_capital_proprio).toBe(400); // 300 + 100
    expect(b.total_passivo).toBe(600); // 400 + 200
    expect(b.autonomia_financeira).toBe(0.4); // 400 / 1000
  });

  it("DR: EBITDA, resultado operacional, RAI e resultado líquido", () => {
    const d = computeDrAno(mapas().dr, 2023);
    expect(d.ebitda).toBe(350); // 1000+100-300-200-250-0
    expect(d.resultado_operacional).toBe(300); // 350-50
    expect(d.rai).toBe(280); // 300-20
    expect(d.resultado_liquido).toBe(250); // 280-30
  });

  it("financiamento: capitais próprios, financiamentos e total", () => {
    const f = computeFinanciamentoAno(mapas().financiamento, 2024);
    expect(f.capitais_proprios).toBe(100);
    expect(f.financiamentos).toBe(300);
    expect(f.financiamento_total).toBe(500); // 100 + 0 + 300 + 100
  });

  it("indicadores: meios libertos líquidos e VAB", () => {
    const ind = computeIndicadores(mapas());
    const mll = ind.find((i) => i.key === "meios_libertos_liquidos")!;
    // RL(250) + D&A(50) + imparidades(0) = 300
    expect(mll.valores["2023"]).toBe(300);
    const vab = ind.find((i) => i.key === "vab")!;
    // 1000 + 100 - 300 - 200 = 600
    expect(vab.valores["2023"]).toBe(600);
  });

  it("GAF pré/pós usa o primeiro e o último ano", () => {
    const g = gafPrePos(mapas());
    expect(g.anoPre).toBe(2023);
    expect(g.anoPos).toBe(2024);
    expect(g.pre).toBe(0.4);
    // 2024: CP=(300+100)/(800+200)=400/1000=0.4
    expect(g.pos).toBe(0.4);
  });

  it("valorRubrica resolve inputs e computed", () => {
    const m = mapas();
    expect(valorRubrica(m, "balanco", "ativo_corrente", 2023)).toBe(400);
    expect(valorRubrica(m, "balanco", "total_ativo", 2023)).toBe(1000);
  });

  it("coerência: assinala balanço que não fecha", () => {
    const m = mapas();
    m.balanco.passivo_corrente = { "2023": 999, "2024": 300 }; // desequilibra 2023
    const issues = validateCoherence(m);
    expect(issues.some((i) => i.mapa === "balanco" && i.ano === 2023)).toBe(true);
  });

  it("coerência: assinala financiamento que não cobre o custo", () => {
    const m = mapas();
    m.financiamento.custo_total = { "2024": 999 };
    const issues = validateCoherence(m);
    expect(issues.some((i) => i.mapa === "financiamento" && i.ano === 2024)).toBe(true);
  });

  it("sem incoerências quando os totais fecham", () => {
    expect(validateCoherence(mapas())).toHaveLength(0);
  });
});
