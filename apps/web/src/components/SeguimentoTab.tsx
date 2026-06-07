import { useState } from "react";
import {
  CHECKLIST_STATUS_LABELS,
  DOCUMENT_TAXONOMY,
  type ChecklistStatus,
  type ReminderState,
  type TrackingItemDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/** Cor/realce por estado (TRNSF-1050): vermelho/amarelo/verde. */
function dot(status: ChecklistStatus): { dotCls: string; badgeCls: string; label: string } {
  if (status === "VALIDADO") return { dotCls: "tk-green", badgeCls: "badge-green", label: CHECKLIST_STATUS_LABELS.VALIDADO };
  if (status === "RECEBIDO") return { dotCls: "tk-amber", badgeCls: "badge-warning", label: CHECKLIST_STATUS_LABELS.RECEBIDO };
  return { dotCls: "tk-red", badgeCls: "badge-danger", label: CHECKLIST_STATUS_LABELS.EM_FALTA };
}

const REMINDER_LABEL: Record<ReminderState, string> = {
  AGENDADO: "agendado",
  ENVIADO: "enviado",
  ESCALADO: "escalado",
  FECHADO: "fechado",
};

/**
 * Separador Checklist & Seguimento (TRNSF-939/1050). Lugar único para:
 *  - pedir documentos ao cliente (gerar/copiar a ligação) — fundido da Recolha;
 *  - ver o estado por tipo (Em falta/Recebido/Validado, por cores);
 *  - acompanhar os lembretes automáticos.
 */
export function SeguimentoTab({ projectId }: { projectId: string }) {
  const tracking = useAsync(() => api.tracking(projectId), [projectId]);
  const collections = useAsync(() => api.collections(projectId), [projectId]);

  // ── pedido de recolha (gerar ligação) ──
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
      collections.reload();
      tracking.reload();
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

  if (tracking.loading) return <p style={{ color: "var(--muted)" }}>A carregar seguimento…</p>;
  if (tracking.error) return <ErrorState error={tracking.error} onRetry={tracking.reload} />;
  if (!tracking.data) return null;
  const data = tracking.data;
  const requests = collections.data?.requests ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      {/* ── Pedir documentos ao cliente (fundido da Recolha — TRNSF-1050) ── */}
      <div className="section-header">
        <div className="section-title">Pedir documentos ao cliente</div>
        <button className="btn btn-primary" onClick={() => setPicking((p) => !p)}>
          {picking ? "Cancelar" : "+ Novo pedido"}
        </button>
      </div>

      {picking && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="login-sub" style={{ marginTop: 0 }}>
            Escolha os documentos a pedir ao cliente:
          </p>
          <div className="recolha-doc-grid">
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

      {requests.map((req) => (
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
          <div style={{ display: "flex", gap: 6 }}>
            <input className="login-input" readOnly value={req.url} style={{ fontSize: 11 }} />
            <button className="btn btn-secondary" onClick={() => copy(req.url, req.id)}>
              {copied === req.id ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>
      ))}

      {/* ── Checklist documental por cores ── */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <div className="section-title">Checklist documental</div>
        <span className={"badge " + (data.complete ? "badge-green" : "badge-muted")}>
          {data.delivered}/{data.total} entregues{data.complete ? " ✓" : ""}
        </span>
      </div>

      <div className="project-table" style={{ borderRadius: 8 }}>
        {data.items.map((it: TrackingItemDTO) => {
          const d = dot(it.status);
          return (
            <div key={it.documentTypeKey} className="folder-row" style={{ justifyContent: "space-between" }}>
              <span className="folder-name">
                <span className={"tk-dot " + d.dotCls} /> {it.documentTypeName}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {it.workdriveUrl && (
                  <a className="folder-link" href={it.workdriveUrl} target="_blank" rel="noreferrer">
                    abrir ↗
                  </a>
                )}
                <span className={"badge " + d.badgeCls}>{d.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Seguimento (lembretes por pedido de recolha) ── */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <div className="section-title">Seguimento automático</div>
      </div>
      {data.followups.length === 0 && (
        <div className="empty"><p>Sem pedidos de recolha com seguimento.</p></div>
      )}
      {data.followups.map((f) => (
        <div className="card" key={f.collectionLinkId} style={{ marginBottom: 10 }}>
          <div className="kc-meta" style={{ marginBottom: 8 }}>
            <span className={"badge " + (f.status === "USADO" ? "badge-green" : f.status === "EXPIRADO" ? "badge-danger" : "badge-muted")}>
              {f.status === "USADO" ? "Concluído" : f.status === "EXPIRADO" ? "Expirado" : "Ativo"}
            </span>
            <span className="deadline-sub">{f.clientEmail ?? "sem email"}</span>
          </div>
          {f.missing.length > 0 && (
            <p style={{ fontSize: 12, color: "var(--danger)" }}>
              Faltam: {f.missing.join(", ")}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {f.reminders.length === 0 && (
              <span className="deadline-sub">Sem lembretes agendados (cliente sem email?).</span>
            )}
            {f.reminders.map((r, i) => (
              <span key={i} className="badge badge-muted">
                Ronda {r.round}: {REMINDER_LABEL[r.state]}
                {r.sentAt ? ` (${new Date(r.sentAt).toLocaleDateString("pt-PT")})` : ` (${new Date(r.scheduledFor).toLocaleDateString("pt-PT")})`}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
