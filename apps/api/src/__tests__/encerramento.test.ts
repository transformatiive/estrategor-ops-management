import { describe, expect, it } from "vitest";
import {
  KANBAN_COLUMNS,
  PROJECT_STATES,
  PROJECT_STATE_LABELS,
  kanbanColumnForState,
} from "@estrategor/shared";

// Estado terminal reversível "Não prosseguiu" (TRNSF-1044).
describe("estado ENCERRADO (TRNSF-1044)", () => {
  it("ENCERRADO faz parte dos estados de projeto", () => {
    expect(PROJECT_STATES).toContain("ENCERRADO");
  });

  it("o rótulo de ENCERRADO é 'Não prosseguiu'", () => {
    expect(PROJECT_STATE_LABELS.ENCERRADO).toBe("Não prosseguiu");
  });

  it("'Não prosseguiu' é uma coluna do kanban", () => {
    expect(KANBAN_COLUMNS).toContain("Não prosseguiu");
  });

  it("ENCERRADO mapeia para a coluna 'Não prosseguiu'", () => {
    expect(kanbanColumnForState("ENCERRADO")).toBe("Não prosseguiu");
  });

  it("kanbanColumnForState cobre todos os estados (mapa total)", () => {
    for (const s of PROJECT_STATES) {
      expect(KANBAN_COLUMNS).toContain(kanbanColumnForState(s));
    }
  });
});
