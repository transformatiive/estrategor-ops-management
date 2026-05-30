import type {
  ChecklistItemDTO,
  CreateUserRequest,
  HealthDTO,
  ProjectDetailDTO,
  ProjectListItemDTO,
  UpdateUserRequest,
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
};
