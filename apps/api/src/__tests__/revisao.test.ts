import { describe, expect, it } from "vitest";
import {
  contarBloqueios,
  deriveRevisaoItemStatus,
  type RevisaoChecklistItemDTO,
} from "@estrategor/shared";

describe("revisão interna A3 (TRNSF-947)", () => {
  describe("deriveRevisaoItemStatus", () => {
    it("indeterminado tem prioridade (sem dados para avaliar)", () => {
      expect(deriveRevisaoItemStatus(true, true)).toBe("indeterminado");
      expect(deriveRevisaoItemStatus(false, true)).toBe("indeterminado");
    });

    it("ok quando a condição está cumprida e há dados", () => {
      expect(deriveRevisaoItemStatus(true, false)).toBe("ok");
    });

    it("falha quando a condição não está cumprida e há dados", () => {
      expect(deriveRevisaoItemStatus(false, false)).toBe("falha");
    });
  });

  describe("contarBloqueios", () => {
    const itens: RevisaoChecklistItemDTO[] = [
      { key: "a", label: "A", status: "ok", detalhe: "" },
      { key: "b", label: "B", status: "falha", detalhe: "" },
      { key: "c", label: "C", status: "indeterminado", detalhe: "" },
      { key: "d", label: "D", status: "falha", detalhe: "" },
    ];

    it("conta apenas os itens em falha", () => {
      expect(contarBloqueios(itens)).toBe(2);
    });

    it("zero quando não há falhas", () => {
      expect(contarBloqueios([{ key: "x", label: "X", status: "ok", detalhe: "" }])).toBe(0);
    });
  });
});
