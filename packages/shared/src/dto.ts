import type {
  ChecklistStatus,
  MilestoneStatus,
  ProgramCode,
  ProjectState,
  Role,
} from "./enums.js";

/** Utilizador como exposto pela API (nunca inclui password_hash). */
export interface UserDTO {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  initials: string;
  color: string;
  active: boolean;
}

/** Resposta do endpoint de saúde (Fase 0). */
export interface HealthDTO {
  status: "ok" | "degraded";
  db: "up" | "down";
  uptimeSeconds: number;
  version: string;
}

/** Resumo de projeto para a lista (B-01). */
export interface ProjectListItemDTO {
  id: string;
  code: string;
  title: string;
  clientName: string;
  program: ProgramCode | string;
  state: ProjectState;
  nextAction: string | null;
  progress: number;
  responsibles: { initials: string; color: string; fullName: string }[];
}

/** Marco da timeline de um projeto. */
export interface MilestoneDTO {
  id: string;
  name: string;
  date: string | null;
  status: MilestoneStatus;
}

/** Detalhe de um projeto para o drawer e a página de projecto (B-01/B-04). */
export interface ProjectDetailDTO {
  id: string;
  code: string;
  title: string;
  clientName: string;
  clientNif: string | null;
  program: ProgramCode | string;
  programName: string;
  state: ProjectState;
  nextAction: string | null;
  progress: number;
  investmentTotal: string | null;
  incentiveValue: string | null;
  responsibles: { initials: string; color: string; fullName: string }[];
  milestones: MilestoneDTO[];
}

/** Item da checklist documental de um projeto (B-04 / D-01). */
export interface ChecklistItemDTO {
  id: string;
  documentTypeKey: string;
  documentTypeName: string;
  status: ChecklistStatus;
  responsible: string | null;
  workdriveUrl: string | null;
}
