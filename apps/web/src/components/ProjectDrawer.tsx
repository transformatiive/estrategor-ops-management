import { useNavigate } from "react-router-dom";
import type { MilestoneStatus } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, ProgramBadge, StateBadge } from "./ui.js";

const MI_CLASS: Record<MilestoneStatus, string> = {
  FEITO: "mi-done",
  ATIVO: "mi-active",
  POR_FAZER: "mi-todo",
};
const MI_ICON: Record<MilestoneStatus, string> = {
  FEITO: "✓",
  ATIVO: "●",
  POR_FAZER: "○",
};

/** Drawer lateral de detalhe de um projecto (equivalente ao #detailOverlay do protótipo). */
export function ProjectDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.project(id), [id]);

  return (
    <div
      className="detail-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="detail-panel">
        <div className="dp-header">
          <div>
            <div className="dp-title">{data?.title ?? "A carregar…"}</div>
            <div className="dp-client">
              {data ? `${data.clientName}${data.clientNif ? ` · ${data.clientNif}` : ""}` : ""}
            </div>
          </div>
          <button className="dp-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="dp-body">
          {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
          {error && (
            <p style={{ color: "var(--danger)" }}>
              Erro ao carregar.{" "}
              <button className="back-link" onClick={reload}>
                Repetir
              </button>
            </p>
          )}

          {data && (
            <>
              <div className="dp-section">
                <div className="dp-section-title">Resumo</div>
                <div className="dp-field">
                  <div className="dp-field-label">Programa</div>
                  <div className="dp-field-value">
                    <ProgramBadge program={data.program} /> {data.programName}
                  </div>
                </div>
                <div className="dp-field">
                  <div className="dp-field-label">Fase</div>
                  <div className="dp-field-value">
                    <StateBadge state={data.state} />
                  </div>
                </div>
                <div className="dp-field">
                  <div className="dp-field-label">Responsável</div>
                  <div className="dp-field-value">
                    <Avatars people={data.responsibles} />
                  </div>
                </div>
                {data.investmentTotal && (
                  <div className="dp-field">
                    <div className="dp-field-label">Investimento</div>
                    <div className="dp-field-value">
                      € {Number(data.investmentTotal).toLocaleString("pt-PT")}
                    </div>
                  </div>
                )}
                {data.incentiveValue && (
                  <div className="dp-field">
                    <div className="dp-field-label">Incentivo</div>
                    <div className="dp-field-value">
                      € {Number(data.incentiveValue).toLocaleString("pt-PT")}
                    </div>
                  </div>
                )}
                <div className="dp-field">
                  <div className="dp-field-label">Próxima acção</div>
                  <div className="dp-field-value">{data.nextAction ?? "—"}</div>
                </div>
              </div>

              <div className="dp-section">
                <div className="dp-section-title">Milestones</div>
                {data.milestones.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 12 }}>Sem milestones.</p>
                )}
                <div className="milestone-list">
                  {data.milestones.map((m) => (
                    <div className="milestone-item" key={m.id}>
                      <div className={`milestone-icon ${MI_CLASS[m.status]}`}>
                        {MI_ICON[m.status]}
                      </div>
                      <div className="milestone-name">{m.name}</div>
                      <div className="milestone-date">{m.date ?? ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="dp-actions">
          <button className="btn btn-secondary">Documentos</button>
          <button className="btn btn-secondary">Nota</button>
          <button className="btn btn-secondary">Prazo</button>
          <button className="btn btn-primary" onClick={() => navigate(`/projetos/${id}`)}>
            → Abrir projecto
          </button>
        </div>
      </div>
    </div>
  );
}
