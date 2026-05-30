import { useState } from "react";
import {
  DOCUMENT_TAXONOMY,
  type CollectionItemDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const STATUS_BADGE: Record<CollectionItemDTO["status"], { cls: string; label: string }> = {
  EM_FALTA: { cls: "badge-danger", label: "Por entregar" },
  RECEBIDO: { cls: "badge-green", label: "Entregue" },
  EM_REVISAO: { cls: "badge-warning", label: "Em validação" },
};

/** Separador Recolha (TRNSF-937): consultor gera pedidos e vê o estado por documento. */
export function RecolhaTab({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync(
    () => api.collections(projectId),
    [projectId],
  );
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [clientEmail, setClientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  async function generate() {
    setFormError(null);
    if (selected.length === 0) {
      setFormError("Escolha pelo menos um documento.");
      return;
    }
    setBusy(true);
    try {
      await api.createCollection(projectId, {
        documentTypeKeys: selected,
        clientEmail: clientEmail.trim() || undefined,
      });
      setPicking(false);
      setSelected([]);
      setClientEmail("");
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Erro ao gerar pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar recolha…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="section-header">
        <div className="section-title">Pedidos de recolha</div>
        <button className="btn btn-primary" onClick={() => setPicking((p) => !p)}>
          {picking ? "Cancelar" : "+ Novo pedido"}
        </button>
      </div>

      {picking && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="login-sub" style={{ marginTop: 0 }}>
            Escolha os documentos a pedir ao cliente:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {DOCUMENT_TAXONOMY.map((d) => (
              <label key={d.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(d.key)}
                  onChange={() => toggle(d.key)}
                />
                {d.name}
              </label>
            ))}
          </div>
          <label className="login-label">Email do cliente (opcional)</label>
          <input
            className="login-input"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="cliente@empresa.pt"
          />
          {formError && <div className="login-error">{formError}</div>}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={generate} disabled={busy}>
              {busy ? "A gerar…" : "Gerar ligação"}
            </button>
          </div>
        </div>
      )}

      {data.requests.length === 0 && !picking && (
        <div className="empty">
          <p>Ainda não há pedidos de recolha.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Gere uma ligação para o cliente entregar os documentos.
          </p>
        </div>
      )}

      {data.requests.map((req) => (
        <div className="card" key={req.id} style={{ marginBottom: 12 }}>
          <div className="kc-meta" style={{ marginBottom: 10 }}>
            <span className={"badge " + (req.status === "ATIVO" ? "badge-green" : req.status === "USADO" ? "badge-muted" : "badge-danger")}>
              {req.status === "ATIVO" ? "Ativo" : req.status === "USADO" ? "Concluído" : "Expirado"}
            </span>
            <span className="deadline-sub">
              expira {new Date(req.expiresAt).toLocaleDateString("pt-PT")}
              {req.clientEmail ? ` · ${req.clientEmail}` : ""}
            </span>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input className="login-input" readOnly value={req.url} style={{ fontSize: 11 }} />
            <button className="btn btn-secondary" onClick={() => copy(req.url, req.id)}>
              {copied === req.id ? "Copiado ✓" : "Copiar"}
            </button>
          </div>

          <div className="project-table" style={{ borderRadius: 8 }}>
            {req.items.map((it) => (
              <div
                key={it.documentTypeKey}
                className="folder-row"
                style={{ justifyContent: "space-between" }}
              >
                <span className="folder-name">{it.documentTypeName}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {it.workdriveUrl && (
                    <a className="folder-link" href={it.workdriveUrl} target="_blank" rel="noreferrer">
                      abrir ↗
                    </a>
                  )}
                  <span className={"badge " + STATUS_BADGE[it.status].cls}>
                    {STATUS_BADGE[it.status].label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
