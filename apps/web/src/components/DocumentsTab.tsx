import { useRef, useState } from "react";
import {
  DOCUMENT_TAXONOMY,
  type DocumentDTO,
  type FolderDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/**
 * Separador Documentos: fila de validação da classificação por IA (TRNSF-938)
 * + árvore de pastas do WorkDrive (TRNSF-936).
 */
export function DocumentsTab({ projectId }: { projectId: string }) {
  const folders = useAsync(() => api.folders(projectId), [projectId]);
  const docs = useAsync(() => api.documents(projectId), [projectId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createFolders() {
    setBusy(true);
    setErr(null);
    try {
      await api.createFolders(projectId);
      folders.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao criar pastas.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadManual(file: File) {
    setBusy(true);
    setErr(null);
    try {
      await api.uploadManualDocument(projectId, file);
      docs.reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro no upload.");
    } finally {
      setBusy(false);
    }
  }

  const fData = folders.data;
  const dData = docs.data;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* ── Fila de validação (IA) ── */}
      <div className="section-header">
        <div className="section-title">Documentos — fila de validação</div>
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadManual(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "A processar…" : "+ Carregar documento"}
          </button>
        </>
      </div>

      {err && <div className="login-error" style={{ marginBottom: 12 }}>{err}</div>}
      {docs.error && <ErrorState error={docs.error} onRetry={docs.reload} />}

      {dData && dData.queue.length === 0 && (
        <div className="empty">
          <p>Sem documentos a aguardar validação.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Documentos entregues pelo cliente ou carregados manualmente aparecem aqui para revisão.
          </p>
        </div>
      )}

      {dData &&
        dData.queue.map((d) => (
          <QueueRow key={d.id} doc={d} onChanged={() => { docs.reload(); folders.reload(); }} />
        ))}

      {/* ── Arquivados ── */}
      {dData && dData.archived.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 24 }}>
            <div className="section-title">Arquivados</div>
          </div>
          <div className="project-table" style={{ borderRadius: 8 }}>
            {dData.archived.map((d) => (
              <div key={d.id} className="folder-row" style={{ justifyContent: "space-between" }}>
                <span className="folder-name">
                  ✓ {d.storedFilename ?? d.originalFilename}
                  <span className="deadline-sub"> · {d.documentTypeName}</span>
                </span>
                {d.workdriveUrl && (
                  <a className="folder-link" href={d.workdriveUrl} target="_blank" rel="noreferrer">
                    abrir ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Pastas do WorkDrive (936) ── */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <div className="section-title">Pastas do projecto (WorkDrive)</div>
        {fData?.provisioned ? (
          <button className="btn btn-secondary" onClick={createFolders} disabled={busy}>
            Repor estrutura
          </button>
        ) : (
          <button className="btn btn-primary" onClick={createFolders} disabled={busy}>
            Criar pastas
          </button>
        )}
      </div>

      {folders.loading && <p style={{ color: "var(--muted)" }}>A carregar pastas…</p>}
      {folders.error && <ErrorState error={folders.error} onRetry={folders.reload} />}

      {fData && !fData.provisioned && fData.folders.length === 0 && (
        <div className="empty"><p>Pastas por criar.</p></div>
      )}

      {fData && fData.folders.length > 0 && (
        <div className="project-table" style={{ borderRadius: 8 }}>
          {[...fData.folders]
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((f: FolderDTO) => (
              <div key={f.id} className="folder-row">
                <span className="folder-name" style={{ paddingLeft: pathDepth(f.path) * 16 }}>
                  {f.isRoot ? "📁" : "📂"} {f.isRoot ? f.name : f.path.split("/").pop() ?? f.name}
                </span>
                {f.workdriveUrl && (
                  <a className="folder-link" href={f.workdriveUrl} target="_blank" rel="noreferrer">
                    abrir ↗
                  </a>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Linha da fila de validação: proposta da IA + confirmar/corrigir/rejeitar. */
function QueueRow({ doc, onChanged }: { doc: DocumentDTO; onChanged: () => void }) {
  const [type, setType] = useState<string>(doc.proposedTypeKey ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    if (!type) {
      setErr("Escolha o tipo de documento.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.validateDocument(doc.id, type);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao validar.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setErr(null);
    try {
      await api.rejectDocument(doc.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao rejeitar.");
    } finally {
      setBusy(false);
    }
  }

  const pageInfo = doc.pageStart ? ` · pág. ${doc.pageStart}–${doc.pageEnd}` : "";
  const pct = doc.confidenceScore !== null ? Math.round(doc.confidenceScore * 100) : null;
  const low = doc.confidence === "BAIXA";
  const proposedName =
    DOCUMENT_TAXONOMY.find((d) => d.key === doc.proposedTypeKey)?.name ?? doc.proposedTypeName;

  return (
    <div className="card queue-card">
      <div className="queue-head">
        <span className="queue-file">
          📄 {doc.originalFilename}
          <span className="deadline-sub">
            {" "}
            · {doc.origin === "CLIENTE" ? "cliente" : "manual"}
            {doc.parentDocumentId ? " · parte" : ""}
            {pageInfo}
          </span>
        </span>
        <a
          className="btn btn-secondary queue-view"
          href={api.documentFileUrl(doc.id)}
          target="_blank"
          rel="noreferrer"
        >
          Ver documento ↗
        </a>
      </div>

      {/* Pré-validação: proposta da IA + confiança */}
      <div className={"queue-ai " + (low ? "queue-ai-low" : "")}>
        <span className="queue-ai-label">Proposta da IA:</span>{" "}
        <b>{proposedName ?? "—"}</b>
        {pct !== null && (
          <span className={"badge " + (low ? "badge-danger" : "badge-green")} style={{ marginLeft: 8 }}>
            {low ? "⚠ confiança baixa" : "confiança"} {pct}%
          </span>
        )}
        {low && (
          <div className="queue-ai-hint">Confirme o tipo e veja o documento antes de arquivar.</div>
        )}
      </div>

      <div className="queue-actions">
        <select className="login-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">— tipo de documento —</option>
          {DOCUMENT_TAXONOMY.map((d) => (
            <option key={d.key} value={d.key}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={confirm} disabled={busy}>
          {busy ? "…" : "Confirmar e arquivar"}
        </button>
        <button className="btn btn-secondary" onClick={reject} disabled={busy}>
          Rejeitar
        </button>
      </div>
      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function pathDepth(path: string): number {
  return path === "" ? 0 : path.split("/").length - 1;
}
