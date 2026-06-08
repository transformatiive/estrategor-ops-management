import { describe, expect, it } from "vitest";
import {
  PERMISSION_KEYS,
  defaultPermissionsForRole,
  hasPermission,
} from "@estrategor/shared";

describe("permissões (TRNSF-1056)", () => {
  it("defaults por papel: gestor recebe as capacidades de gestão; consultor nenhuma", () => {
    expect(defaultPermissionsForRole("GESTOR")).toContain("aprovar_revisao_interna");
    expect(defaultPermissionsForRole("GESTOR")).toContain("reabrir_projeto");
    expect(defaultPermissionsForRole("CONSULTOR")).toEqual([]);
  });

  it("ADMIN é super-utilizador (tem sempre qualquer permissão)", () => {
    for (const key of PERMISSION_KEYS) {
      expect(hasPermission({ role: "ADMIN", permissions: [] }, key)).toBe(true);
    }
  });

  it("não-admin segue o conjunto explícito", () => {
    const consultor = { role: "CONSULTOR" as const, permissions: ["aprovar_revisao_interna"] };
    expect(hasPermission(consultor, "aprovar_revisao_interna")).toBe(true);
    expect(hasPermission(consultor, "gerir_avisos")).toBe(false);
    expect(hasPermission({ role: "CONSULTOR", permissions: [] }, "aprovar_revisao_interna")).toBe(false);
  });
});
