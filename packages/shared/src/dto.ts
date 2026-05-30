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

/** Credenciais de login (TRNSF-934). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Criação de utilizador (gestor/admin). */
export interface CreateUserRequest {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

/** Edição de utilizador (campos opcionais). */
export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  role?: Role;
  active?: boolean;
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

/** Criação manual de um projecto (B-02). */
export interface CreateProjectRequest {
  title: string;
  clientName: string;
  clientNif?: string;
  program: ProgramCode;
  /** rótulo da medida/aviso (nomeia a pasta em 1-INCENTIVOS), opcional */
  measureLabel?: string;
  responsibleIds?: string[];
}

/** Pasta do WorkDrive associada a um projecto (TRNSF-936). */
export interface FolderDTO {
  id: string;
  path: string;
  name: string;
  parentPath: string | null;
  isRoot: boolean;
  workdriveId: string | null;
  workdriveUrl: string | null;
}

/** Estado das pastas de um projecto no separador Documentos. */
export interface ProjectFoldersDTO {
  provisioned: boolean;
  rootFolderId: string | null;
  folders: FolderDTO[];
}
