import { useState } from "react";
import type { FolderDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/** Indenta o caminho lógico pela profundidade (nº de "/"). */
function depth(path: string): number {
  if (!path) return 0;
  return path.split("/").length;
}

/** Separador Documentos (TRNSF-936): mostra a árvore de pastas do WorkDrive. */
export function DocumentsTab({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync(
    () => api.folders(projectId),
    [projectId],
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function createFolders() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.createFolders(projectId);
      reload();
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : "Erro ao criar pastas.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar pastas…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  // pasta-raiz + subpastas ordenadas
  const root = data.folders.find((f) => f.isRoot);
  const subfolders = data.folders
    .filter((f) => !f.isRoot)
    .sort((a, b) => a.path.localeCompare(b.path, "pt"));

  if (!data.provisioned) {
    return (
      <div className="empty">
        <p>Pastas por criar.</p>
        <p style={{ fontSize: 12, margin: "4px 0 12px" }}>
          Este projecto ainda não tem a estrutura de pastas no WorkDrive.
        </p>
        <button className="btn btn-primary" onClick={createFolders} disabled={creating}>
          {creating ? "A criar pastas…" : "Criar pastas"}
        </button>
        {createError && <div className="login-error" style={{ marginTop: 12 }}>{createError}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="section-header">
        <div className="section-title">{root?.name ?? "Pastas do projecto"}</div>
        <button className="btn btn-secondary" onClick={createFolders} disabled={creating}>
          {creating ? "A repor…" : "Repor estrutura"}
        </button>
      </div>
      {createError && <div className="login-error" style={{ marginBottom: 12 }}>{createError}</div>}
      <div className="card" style={{ padding: 0 }}>
        {subfolders.map((f: FolderDTO) => (
          <div
            key={f.id}
            className="folder-row"
            style={{ paddingLeft: 16 + depth(f.path) * 18 }}
          >
            <span className="folder-icon">📁</span>
            <span className="folder-name">{f.name}</span>
            {f.workdriveUrl && (
              <a className="folder-link" href={f.workdriveUrl} target="_blank" rel="noreferrer">
                abrir ↗
              </a>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--hint)", marginTop: 8 }}>
        Estrutura sincronizada com o Zoho WorkDrive.
      </p>
    </div>
  );
}
