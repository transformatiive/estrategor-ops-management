/**
 * Permissões (capacidades) configuráveis por utilizador — fundação RBAC
 * (TRNSF-1056). Para além do papel (Gestor/Consultor/Admin), cada utilizador
 * tem um conjunto de permissões definível no backoffice de Gestão de
 * utilizadores. ADMIN é super-utilizador (tem sempre todas).
 */

import type { Role } from "./enums.js";

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  /** papéis que recebem esta permissão por omissão (pré-preenchimento) */
  defaultRoles: Role[];
}

/** Catálogo de permissões (cresce à medida das funcionalidades). */
export const PERMISSIONS: PermissionDef[] = [
  {
    key: "aprovar_revisao_interna",
    label: "Aprovar revisão interna",
    description: "Aprovar a candidatura na revisão interna (A3 → submissão) ou devolvê-la.",
    defaultRoles: ["GESTOR", "ADMIN"],
  },
  {
    key: "reabrir_projeto",
    label: "Reabrir projeto encerrado",
    description: "Reabrir um projeto em estado «Não prosseguiu» (volta a A0).",
    defaultRoles: ["GESTOR", "ADMIN"],
  },
  {
    key: "gerir_avisos",
    label: "Gerir catálogo de avisos",
    description: "Criar e editar avisos e grelhas de mérito.",
    defaultRoles: ["GESTOR", "ADMIN"],
  },
];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/** Permissões atribuídas por omissão a um papel (pré-preenche o backoffice). */
export function defaultPermissionsForRole(role: Role): string[] {
  return PERMISSIONS.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
}

/**
 * O utilizador tem a permissão? ADMIN é super-utilizador (sempre true); os
 * restantes seguem o conjunto explícito guardado no utilizador.
 */
export function hasPermission(
  user: { role: Role; permissions?: readonly string[] | null },
  key: PermissionKey,
): boolean {
  if (user.role === "ADMIN") return true;
  return (user.permissions ?? []).includes(key);
}
