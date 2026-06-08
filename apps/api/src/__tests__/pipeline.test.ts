import { describe, expect, it } from "vitest";
import {
  PIPELINE_FASES,
  STATE_BADGE_LABEL,
  STATE_TO_FASE,
  computePipeline,
  vistasDaFase,
} from "@estrategor/shared";

describe("pipeline em linguagem de cliente (TRNSF-963)", () => {
  it("os badges não expõem códigos internos (A0–A4/B*)", () => {
    for (const label of Object.values(STATE_BADGE_LABEL)) {
      expect(label).not.toMatch(/\bA[0-4]\b|\bB[0-2]\b|Fase [AB]/);
    }
  });

  it("mapeia todos os estados para uma fase existente", () => {
    const keys = new Set(PIPELINE_FASES.map((f) => f.key));
    for (const fase of Object.values(STATE_TO_FASE)) expect(keys.has(fase)).toBe(true);
  });

  it("na Preparação: anteriores concluídas, atual em curso, execução esbatida", () => {
    const { passos, progresso } = computePipeline("preparacao");
    const byKey = Object.fromEntries(passos.map((p) => [p.key, p.estado]));
    expect(byKey.diagnostico).toBe("concluido");
    expect(byKey.recolha).toBe("concluido");
    expect(byKey.preparacao).toBe("em_curso");
    expect(byKey.revisao).toBe("por_iniciar");
    // TRNSF-1067: Análise é agora candidatura (por iniciar); a Execução (termo)
    // é que fica esbatida.
    expect(byKey.analise).toBe("por_iniciar");
    expect(byKey.termo).toBe("execucao"); // bloco execução esbatido
    expect(progresso).toEqual({ concluidas: 2, total: 7 });
  });

  it("numa fase de execução, a candidatura está toda concluída", () => {
    const { passos } = computePipeline("execucao");
    const cand = passos.filter((p) => p.bloco === "candidatura");
    expect(cand.every((p) => p.estado === "concluido")).toBe(true);
  });

  it("as vistas da Preparação incluem Candidatura e Extração", () => {
    const v = vistasDaFase("preparacao");
    expect(v).toContain("candidatura");
    expect(v).toContain("extracao");
  });
});
