import { useNavigate } from "react-router-dom";
import type { UrgentDeadlineDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "../components/ui.js";

const SEV_BADGE: Record<UrgentDeadlineDTO["severity"], string> = {
  atrasado: "badge-danger",
  urgente: "badge-warning",
  proximo: "badge-muted",
};

/** Vista Prazos (TRNSF-939): deadlines do projeto + recolhas em atraso. */
export function Prazos() {
  const { data, loading, error, reload } = useAsync(() => api.urgentDeadlines());
  const navigate = useNavigate();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Prazos</div>
          <div className="page-subtitle">Prazos do projeto e recolhas em atraso</div>
        </div>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <div className="empty"><p>Sem prazos urgentes. 🎉</p></div>
      )}

      {data && data.length > 0 && (
        <div className="project-table">
          <div className="pt-head" style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr" }}>
            <div className="pt-head-cell">Obrigação</div>
            <div className="pt-head-cell">Projecto</div>
            <div className="pt-head-cell">Tipo</div>
            <div className="pt-head-cell">Estado</div>
          </div>
          {data.map((d, i) => (
            <div
              key={i}
              className="pt-row"
              style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr" }}
              onClick={() => navigate(`/projetos/${d.projectId}`)}
            >
              <div className="pt-cell">
                <div className="proj-name">{d.label}</div>
                {d.dueDate && (
                  <div className="proj-ref">{new Date(d.dueDate).toLocaleDateString("pt-PT")}</div>
                )}
              </div>
              <div className="pt-cell">
                <div className="proj-name">{d.projectTitle}</div>
                <div className="proj-client">{d.clientName}</div>
              </div>
              <div className="pt-cell">
                <span className="badge badge-muted">{d.kind === "recolha" ? "Recolha" : "Prazo"}</span>
              </div>
              <div className="pt-cell">
                <span className={"badge " + SEV_BADGE[d.severity]}>
                  {d.daysOverdue > 0 ? `${d.daysOverdue}d em atraso` : `em ${-d.daysOverdue}d`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
