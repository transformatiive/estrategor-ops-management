import { describe, expect, it } from "vitest";
import {
  REMINDER_ROUNDS,
  addBusinessDays,
  daysBetween,
  deriveChecklistStatus,
  isDelivered,
  reminderEmail,
} from "@estrategor/shared";

describe("deriveChecklistStatus (TRNSF-1050)", () => {
  it("sem documentos → EM_FALTA (vermelho)", () => {
    expect(deriveChecklistStatus([])).toBe("EM_FALTA");
  });
  it("documento na fila de validação → RECEBIDO (amarelo)", () => {
    expect(deriveChecklistStatus(["a_validar"])).toBe("RECEBIDO");
    expect(deriveChecklistStatus(["em_analise"])).toBe("RECEBIDO");
  });
  it("documento arquivado → VALIDADO (verde), mesmo com outros na fila", () => {
    expect(deriveChecklistStatus(["arquivado"])).toBe("VALIDADO");
    expect(deriveChecklistStatus(["a_validar", "arquivado"])).toBe("VALIDADO");
  });
  it("estados irrelevantes (rejeitado/dividido) não contam como entregue", () => {
    expect(deriveChecklistStatus(["rejeitado"])).toBe("EM_FALTA");
    expect(deriveChecklistStatus(["dividido"])).toBe("EM_FALTA");
  });
});

describe("isDelivered (TRNSF-1050/1051)", () => {
  it("RECEBIDO e VALIDADO contam como entregue; EM_FALTA não", () => {
    expect(isDelivered("RECEBIDO")).toBe(true);
    expect(isDelivered("VALIDADO")).toBe(true);
    expect(isDelivered("EM_FALTA")).toBe(false);
  });
  it("o rótulo legado EM_REVISAO conta como entregue", () => {
    expect(isDelivered("EM_REVISAO")).toBe(true);
  });
});

describe("addBusinessDays (§9)", () => {
  it("sexta + 1 dia útil = segunda", () => {
    // 2026-05-29 é sexta-feira
    const fri = new Date("2026-05-29T09:00:00Z");
    const r = addBusinessDays(fri, 1);
    expect(r.getUTCDay()).toBe(1); // segunda
  });

  it("salta o fim-de-semana em T+3", () => {
    const wed = new Date("2026-05-27T09:00:00Z"); // quarta
    const r = addBusinessDays(wed, 3); // qui, sex, seg
    expect(r.getUTCDay()).toBe(1); // segunda
  });

  it("rondas configuradas: T+1, T+3, T+5 (3.ª com cópia ao consultor)", () => {
    expect(REMINDER_ROUNDS.map((r) => r.businessDays)).toEqual([1, 3, 5]);
    expect(REMINDER_ROUNDS[2]!.ccConsultor).toBe(true);
    expect(REMINDER_ROUNDS[0]!.ccConsultor).toBe(false);
  });
});

describe("daysBetween", () => {
  it("conta dias de calendário, nunca negativo", () => {
    expect(daysBetween(new Date("2026-05-01"), new Date("2026-05-06"))).toBe(5);
    expect(daysBetween(new Date("2026-05-06"), new Date("2026-05-01"))).toBe(0);
  });
});

describe("reminderEmail (§9)", () => {
  const base = {
    projectTitle: "DIRSIL — Transformação Digital",
    clientName: "DIRSIL",
    link: "https://app/recolha/abc",
    missing: ["IES (3 anos)", "RCBE"],
  };
  it("ronda 1: cordial, com a ligação", () => {
    const m = reminderEmail({ ...base, round: 1 });
    expect(m.body).toContain("https://app/recolha/abc");
    expect(m.subject).toContain("DIRSIL");
  });
  it("ronda 2: inclui a lista do que falta", () => {
    const m = reminderEmail({ ...base, round: 2 });
    expect(m.body).toContain("IES (3 anos)");
    expect(m.body).toContain("RCBE");
  });
  it("ronda 3: escalamento com nota de cópia ao consultor", () => {
    const m = reminderEmail({ ...base, round: 3 });
    expect(m.subject.toLowerCase()).toContain("urgente");
    expect(m.body.toLowerCase()).toContain("consultor");
  });
});
