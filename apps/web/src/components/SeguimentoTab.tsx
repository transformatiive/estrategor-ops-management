import type { ReminderState, TrackingItemDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

function dot(status: TrackingItemDTO["status"]): { cls: string; label: string } {
  if (status === "RECEBIDO") return { cls: "tk-green", label: "Entregue" };
  if (status === "EM_REVISAO") return { cls: "tk-amber", label: "Em validação" };
  return { cls: "tk-red", label: "Em falta" };
}

const REMINDER_LABEL: Record<ReminderState, string> = {
  AGENDADO: "agendado",
  ENVIADO: "enviado",
  ESCALADO: "escalado",
  FECHADO: "fechado",
};

/** Separador Checklist & Seguimento (TRNSF-939): verde/vermelho + lembretes. */
export function SeguimentoTab({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync(() => api.tracking(projectId), [projectId]);

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar seguimento…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="section-header">
        <div className="section-title">Checklist documental</div>
        <span className={"badge " + (data.complete ? "badge-green" : "badge-muted")}>
          {data.delivered}/{data.total} entregues{data.complete ? " ✓" : ""}
        </span>
      </div>

      <div className="project-table" style={{ borderRadius: 8 }}>
        {data.items.map((it) => {
          const d = dot(it.status);
          return (
            <div key={it.documentTypeKey} className="folder-row" style={{ justifyContent: "space-between" }}>
              <span className="folder-name">
                <span className={"tk-dot " + d.cls} /> {it.documentTypeName}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {it.workdriveUrl && (
                  <a className="folder-link" href={it.workdriveUrl} target="_blank" rel="noreferrer">
                    abrir ↗
                  </a>
                )}
                <span className={"badge " + (it.delivered ? "badge-green" : it.status === "EM_REVISAO" ? "badge-warning" : "badge-danger")}>
                  {d.label}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Seguimento (lembretes por pedido de recolha) */}
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
