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

/** Utilizador atribuível como responsável de projeto (seletor na criação). */
export interface AssignableUserDTO {
  id: string;
  fullName: string;
  role: Role;
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
  /** família do sistema de incentivos, quando já definida no projeto */
  family: string | null;
  nextAction: string | null;
  progress: number;
  responsibles: { id: string; initials: string; color: string; fullName: string }[];
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
  /** família do sistema de incentivos, quando já definida */
  family: string | null;
  /** referência à oportunidade no Zoho CRM (read-only), quando presente */
  crmDealId: string | null;
  responsibles: { id: string; initials: string; color: string; fullName: string }[];
  milestones: MilestoneDTO[];
}

/**
 * Edição do cabeçalho do projeto (TRNSF-1027). Todos os campos opcionais.
 * RBAC na API: gestor/admin pode tudo; consultor só `responsibleIds`.
 */
export interface UpdateProjectRequest {
  title?: string;
  clientName?: string;
  program?: ProgramCode;
  family?: string | null;
  responsibleIds?: string[];
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

// ─── Recolha ao Cliente (TRNSF-937) ──────────────────────────────────────

/** Pedido para gerar um link de recolha (consultor escolhe os tipos). */
export interface CreateCollectionRequest {
  documentTypeKeys: string[];
  clientEmail?: string;
  message?: string;
  /** validade em dias (default no servidor) */
  expiresInDays?: number;
}

/** Estado de um item da recolha por tipo de documento. */
export interface CollectionItemDTO {
  documentTypeKey: string;
  documentTypeName: string;
  status: ChecklistStatus; // EM_FALTA | RECEBIDO | EM_REVISAO
  documentId: string | null;
  fileName: string | null;
  workdriveUrl: string | null;
}

/** Resumo de um pedido de recolha (vista do consultor, separador Recolha). */
export interface CollectionRequestDTO {
  id: string;
  token: string;
  url: string;
  status: "ATIVO" | "USADO" | "EXPIRADO";
  clientEmail: string | null;
  expiresAt: string;
  createdAt: string;
  items: CollectionItemDTO[];
}

/** Estado da recolha de um projecto (lista de pedidos). */
export interface ProjectCollectionDTO {
  requests: CollectionRequestDTO[];
}

/** Vista pública do formulário do cliente (sem login, via token). */
export interface PublicCollectionDTO {
  projectTitle: string;
  clientName: string;
  programCode: string;
  status: "ATIVO" | "USADO" | "EXPIRADO";
  expiresAt: string;
  items: {
    documentTypeKey: string;
    documentTypeName: string;
    delivered: boolean;
  }[];
}

// ─── A0 Diagnóstico (TRNSF-940/941) ──────────────────────────────────────

export type ConditionStatus = "PASSA" | "FALHA" | "NA";
export type DiagnosticResult =
  | "POR_INICIAR"
  | "EM_PREENCHIMENTO"
  | "ELEGIVEL"
  | "NAO_ELEGIVEL"
  | "A_REVER"
  | "SEM_GRELHA";

/** Sugestão da pré-análise (TRNSF-1029): indício recolhido ou dados em falta.
 *  Nunca decide elegibilidade — o `status` continua a ser do consultor. */
export type CondSugestao = "indicio" | "sem_dados";

export interface ConditionStateDTO {
  key: string;
  label: string;
  status: ConditionStatus;
  note?: string;
  /** sugestão calculada a partir do pré-diagnóstico (não persistida) */
  sugestao?: CondSugestao | null;
  /** evidência recolhida ou o que falta confirmar (não persistido) */
  sugestaoNota?: string | null;
}

/** Grelha aplicável a um projecto/aviso (ou indicação de ausência). */
export interface MeritGridSummaryDTO {
  id: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string | null;
  mpMinimo: number | null;
  minimoPorCriterio: number | null;
  formulaMp: string | null;
}

/** Estado do separador Diagnóstico de um projecto. */
export interface DiagnosticDTO {
  projectId: string;
  programCode: string;
  result: DiagnosticResult;
  eligible: boolean | null;
  mp: number | null;
  gridVersion: string | null;
  // região do investimento (resolve a matriz regional A.1); regiões disponíveis na grelha
  regiao: string | null;
  availableRegions: string[];
  // condições de acesso (dados do aviso) com o estado escolhido
  conditions: ConditionStateDTO[];
  // grelha de mérito disponível (ou null → "Grelha não configurada")
  grid: MeritGridSummaryDTO | null;
  // estrutura da grelha para o ecrã (critérios/subcritérios/opções)
  gridData: unknown | null;
  // selecções do consultor por subcritério
  meritSelection: Record<string, number>;
  // breakdown calculado (null enquanto incompleto)
  meritBreakdown: unknown | null;
  updatedAt: string | null;
}

/** Pedido para guardar/atualizar o diagnóstico. */
export interface SaveDiagnosticRequest {
  conditions?: ConditionStateDTO[];
  meritSelection?: Record<string, number>;
  regiao?: string | null;
}
