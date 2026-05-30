import { useState } from "react";
import {
  KANBAN_COLUMNS,
  kanbanColumnForState,
  type KanbanColumn,
  type ProjectListItemDTO,
} from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, ErrorState, ProgramBadge } from "../components/ui.js";
import { ProjectDrawer } from "../components/ProjectDrawer.js";

export function Pt2030() {
  const { data, loading, error, reload } = useAsync(() => api.projects());
  const [selected, setSelected] = useState<string | null>(null);

  // só projectos PT2030 entram no kanban (RFAI/SIFIDE/Formação ficam de fora)
  const pt = (data ?? []).filter((p) => p.program === "PT2030");
  const byColumn: Record<KanbanColumn, ProjectListItemDTO[]> = {
    Candidatura: [],
    "Em preparação": [],
    Aprovado: [],
    Execução: [],
    Encerramento: [],
  };
  for (const p of pt) byColumn[kanbanColumnForState(p.state)].push(p);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">PT2030 — por fase</div>
          <div className="page-subtitle">
            {loading ? " " : `${pt.length} projectos PT2030`}
          </div>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}

      {!error && (
        <div className="kanban">
          {KANBAN_COLUMNS.map((col) => (
            <div className="kanban-col" key={col}>
              <div className="kanban-col-header">
                <span className="kanban-col-title">{col}</span>
                <span className="kanban-count">{byColumn[col].length}</span>
              </div>
              <div className="kanban-col-body">
                {loading && (
                  <div className="kanban-card">
                    <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: "50%" }} />
                  </div>
                )}
                {byColumn[col].map((p) => (
                  <div
                    className="kanban-card"
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                  >
                    <div className="kc-title">{p.title}</div>
                    <div className="kc-client">{p.clientName}</div>
                    <div className="kc-meta">
                      <ProgramBadge program={p.program} />
                      <Avatars people={p.responsibles} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ProjectDrawer id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
