/**
 * Enums de domínio partilhados entre API e Web.
 * Os valores espelham os enums do Prisma (apps/api/prisma/schema.prisma).
 */

/** Perfil do utilizador (spec §4: gestor | consultor | admin). */
export const ROLES = ["GESTOR", "CONSULTOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  GESTOR: "Gestor",
  CONSULTOR: "Consultor",
  ADMIN: "Admin",
};

/**
 * Pode gerir utilizadores? (TRNSF-934) gestor e admin gerem; consultor não.
 */
export function canManageUsers(role: Role): boolean {
  return role === "GESTOR" || role === "ADMIN";
}

/**
 * Estados de um projeto (spec §8). A0–A4 = Fase A (candidatura/diagnóstico);
 * B0–B2 = Fase B (execução).
 */
export const PROJECT_STATES = [
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "B0",
  "B1",
  "B2",
  // Estado terminal reversível "Não prosseguiu" (TRNSF-1044): um diagnóstico A0
  // que não passa pode ser encerrado com justificação; gestor/admin reabre → A0.
  "ENCERRADO",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

/** Rótulos legíveis para cada estado de projeto (spec §8, v2026-05-30). */
export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  A0: "A0 · Diagnóstico",
  A1: "A1 · Recolha",
  A2: "A2 · Preparação",
  A3: "A3 · Revisão",
  A4: "A4 · Submissão",
  B0: "B0 · Arranque",
  B1: "B1 · Execução",
  B2: "B2 · Encerramento",
  ENCERRADO: "Não prosseguiu",
};

/**
 * Colunas do kanban PT2030 e o mapeamento estado → coluna (spec §8).
 * Candidatura(A0,A1) · Em preparação(A2,A3) · Aprovado(A4,B0) · Execução(B1) · Encerramento(B2).
 */
export const KANBAN_COLUMNS = [
  "Candidatura",
  "Em preparação",
  "Aprovado",
  "Execução",
  "Encerramento",
  // Estado terminal reversível de um diagnóstico A0 que não passa (TRNSF-1044).
  "Não prosseguiu",
] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

const STATE_TO_COLUMN: Record<ProjectState, KanbanColumn> = {
  A0: "Candidatura",
  A1: "Candidatura",
  A2: "Em preparação",
  A3: "Em preparação",
  A4: "Aprovado",
  B0: "Aprovado",
  B1: "Execução",
  B2: "Encerramento",
  ENCERRADO: "Não prosseguiu",
};

/** Devolve a coluna do kanban PT2030 para um dado estado. */
export function kanbanColumnForState(state: ProjectState): KanbanColumn {
  return STATE_TO_COLUMN[state];
}

/** Marcos da timeline de um projeto (drawer de detalhe). */
export const MILESTONE_STATUSES = ["FEITO", "ATIVO", "POR_FAZER"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** Estado de cada item da checklist documental (Épicos D/F). */
export const CHECKLIST_STATUSES = ["EM_FALTA", "RECEBIDO", "EM_REVISAO"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

/** Confiança da classificação por IA (Épico E). */
export const DOC_CONFIDENCE = ["ALTA", "BAIXA"] as const;
export type DocConfidence = (typeof DOC_CONFIDENCE)[number];

/** Estado do ciclo de lembretes (Épico F). */
export const REMINDER_STATUSES = [
  "AGENDADO",
  "ENVIADO",
  "ESCALADO",
  "FECHADO",
] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** Códigos de programa/medida conhecidos (referência da taxonomia). */
export const PROGRAM_CODES = ["PT2030", "RFAI", "SIFIDE", "FORMACAO"] as const;
export type ProgramCode = (typeof PROGRAM_CODES)[number];
