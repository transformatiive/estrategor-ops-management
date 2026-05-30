import { describe, expect, it } from "vitest";
import { canManageUsers } from "@estrategor/shared";
import { hashPassword, verifyPassword } from "../auth/password.js";

describe("canManageUsers (RBAC — TRNSF-934)", () => {
  it("gestor e admin podem gerir utilizadores; consultor não", () => {
    expect(canManageUsers("GESTOR")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("CONSULTOR")).toBe(false);
  });
});

describe("hashPassword/verifyPassword (Argon2id)", () => {
  it("gera um hash argon2id e valida a palavra-passe correta", async () => {
    const hash = await hashPassword("segredo-123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("segredo-123", hash)).toBe(true);
  });

  it("rejeita palavra-passe errada e hash inválido sem rebentar", async () => {
    const hash = await hashPassword("segredo-123");
    expect(await verifyPassword("errada", hash)).toBe(false);
    expect(await verifyPassword("x", "não-é-um-hash")).toBe(false);
  });
});
