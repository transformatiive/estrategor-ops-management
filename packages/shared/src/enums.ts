/**
 * Enums de domínio partilhados entre API e Web.
 * Os valores espelham os enums do Prisma (apps/api/prisma/schema.prisma).
 */

/** Perfil do utilizador (Épico A). */
export const ROLES = ["ADMIN", "PADRAO"] as const;
export type Role = (typeof ROLES)[number];

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
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

/** Rótulos legíveis para cada estado de projeto (PT-PT). */
export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  A0: "A0 · Diagnóstico",
  A1: "A1 · Recolha",
  A2: "A2 · Preparação",
  A3: "A3 · Submissão",
  A4: "A4 · Análise",
  B0: "B0 · Aprovado",
  B1: "B1 · Execução",
  B2: "B2 · Encerramento",
};

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
