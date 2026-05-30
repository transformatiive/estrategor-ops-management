import type {
  ChecklistItemDTO,
  CollectionRequestDTO,
  CreateCollectionRequest,
  CreateProjectRequest,
  CreateUserRequest,
  DiagnosticDTO,
  HealthDTO,
  ProjectCollectionDTO,
  ProjectDetailDTO,
  ProjectDocumentsDTO,
  ProjectFoldersDTO,
  ProjectListItemDTO,
  ProjectTrackingDTO,
  PublicCollectionDTO,
  SaveDiagnosticRequest,
  UpdateUserRequest,
  UrgentDeadlineDTO,
  UserDTO,
} from "@estrategor/shared";

// Em dev usamos o proxy do Vite (caminhos relativos). Em produção a SPA e a API
// podem estar em domínios diferentes — define VITE_API_URL nesse caso.
const BASE = import.meta.env.VITE_API_URL ?? "";

/** Erro HTTP com a mensagem devolvida pela API (campo `error`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const api = {
  health: () => get<HealthDTO>("/health"),

  // auth (TRNSF-934)
  login: (email: string, password: string) =>
    post<UserDTO>("/api/auth/login", { email, password }),
  logout: () => post<{ ok: boolean }>("/api/auth/logout"),
  session: () => get<{ user: null } | UserDTO>("/api/auth/session"),

  // utilizadores (gestor/admin)
  users: () => get<UserDTO[]>("/api/users"),
  createUser: (data: CreateUserRequest) => post<UserDTO>("/api/users", data),
  updateUser: (id: string, data: UpdateUserRequest) =>
    patch<UserDTO>(`/api/users/${id}`, data),
  resetPassword: (id: string, password: string) =>
    post<{ ok: boolean }>(`/api/users/${id}/reset-password`, { password }),

  // projetos
  projects: () => get<ProjectListItemDTO[]>("/api/projects"),
  project: (id: string) => get<ProjectDetailDTO>(`/api/projects/${id}`),
  checklist: (id: string) => get<ChecklistItemDTO[]>(`/api/projects/${id}/checklist`),
  createProject: (data: CreateProjectRequest) =>
    post<{ id: string; code: string; foldersError: string | null }>("/api/projects", data),

  // pastas WorkDrive (TRNSF-936)
  folders: (id: string) => get<ProjectFoldersDTO>(`/api/projects/${id}/folders`),
  createFolders: (id: string) => post<ProjectFoldersDTO>(`/api/projects/${id}/folders`),

  // recolha ao cliente (TRNSF-937)
  collections: (id: string) => get<ProjectCollectionDTO>(`/api/projects/${id}/collections`),
  createCollection: (id: string, data: CreateCollectionRequest) =>
    post<CollectionRequestDTO>(`/api/projects/${id}/collections`, data),

  // rastreio e seguimento (TRNSF-939)
  tracking: (id: string) => get<ProjectTrackingDTO>(`/api/projects/${id}/tracking`),
  urgentDeadlines: () => get<UrgentDeadlineDTO[]>("/api/deadlines/urgent"),

  // documentos / classificação IA (TRNSF-938)
  documents: (id: string) => get<ProjectDocumentsDTO>(`/api/projects/${id}/documents`),
  validateDocument: (docId: string, documentTypeKey: string) =>
    post<{ ok: boolean }>(`/api/documents/${docId}/validate`, { documentTypeKey }),
  rejectDocument: (docId: string) => post<{ ok: boolean }>(`/api/documents/${docId}/reject`),
  uploadManualDocument: async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/projects/${projectId}/documents`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const b = (await res.json()) as { error?: string };
        if (b?.error) msg = b.error;
      } catch {
        /* não-JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return (await res.json()) as { ok: boolean; documentId: string; status: string };
  },

  // diagnóstico A0 (TRNSF-940)
  diagnostic: (id: string) => get<DiagnosticDTO>(`/api/projects/${id}/diagnostic`),
  saveDiagnostic: (id: string, data: SaveDiagnosticRequest) =>
    put<DiagnosticDTO>(`/api/projects/${id}/diagnostic`, data),
  advanceDiagnostic: (id: string) =>
    post<{ ok: boolean; state: string }>(`/api/projects/${id}/diagnostic/advance`),

  // formulário público do cliente (sem login)
  publicCollection: (token: string) =>
    get<PublicCollectionDTO>(`/api/recolha/${token}`),
  uploadDocument: async (token: string, file: File, typeKey?: string) => {
    const form = new FormData();
    form.append("file", file);
    const qs = typeKey ? `?type=${encodeURIComponent(typeKey)}` : "";
    const res = await fetch(
      `${BASE}/api/recolha/${token}/upload${qs}`,
      { method: "POST", body: form },
    );
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const b = (await res.json()) as { error?: string };
        if (b?.error) msg = b.error;
      } catch {
        /* não-JSON */
      }
      throw new ApiError(res.status, msg);
    }
    return (await res.json()) as { ok: boolean; storedFilename: string };
  },
};
