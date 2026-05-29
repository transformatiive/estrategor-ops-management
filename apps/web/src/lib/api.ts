import type {
  ChecklistItemDTO,
  HealthDTO,
  ProjectListItemDTO,
} from "@estrategor/shared";

// Em dev usamos o proxy do Vite (caminhos relativos). Em produção a SPA e a API
// podem estar em domínios diferentes — define VITE_API_URL nesse caso.
const BASE = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  health: () => get<HealthDTO>("/health"),
  projects: () => get<ProjectListItemDTO[]>("/api/projects"),
  checklist: (id: string) =>
    get<ChecklistItemDTO[]>(`/api/projects/${id}/checklist`),
};
