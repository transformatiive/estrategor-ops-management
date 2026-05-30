import { useState } from "react";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import {
  Avatars,
  EmptyState,
  ErrorState,
  Progress,
  ProgramBadge,
  StateBadge,
  TableSkeleton,
} from "../components/ui.js";
import { ProjectDrawer } from "../components/ProjectDrawer.js";

export function Projetos() {
  const { data: projects, loading, error, reload } = useAsync(() => api.projects());
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Projectos</div>
          <div className="page-subtitle">
            {projects ? `${projects.length} projectos` : " "}
          </div>
        </div>
        <button className="btn btn-primary">+ Novo projecto</button>
      </div>

      {loading && <TableSkeleton />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {projects && projects.length === 0 && (
        <EmptyState message="Sem projectos ainda." />
      )}

      {projects && projects.length > 0 && (
        <div className="project-table">
          <div className="pt-head">
            <div className="pt-head-cell">Projecto / Cliente</div>
            <div className="pt-head-cell">Programa</div>
            <div className="pt-head-cell">Fase</div>
            <div className="pt-head-cell">Progresso</div>
            <div className="pt-head-cell">Próxima acção</div>
            <div className="pt-head-cell">Equipa</div>
          </div>
          {projects.map((p) => (
            <div className="pt-row" key={p.id} onClick={() => setSelected(p.id)}>
              <div className="pt-cell">
                <div className="proj-name">{p.title}</div>
                <div className="proj-client">{p.clientName}</div>
                <div className="proj-ref">{p.code}</div>
              </div>
              <div className="pt-cell">
                <ProgramBadge program={p.program} />
              </div>
              <div className="pt-cell">
                <StateBadge state={p.state} />
              </div>
              <div className="pt-cell">
                <Progress value={p.progress} />
              </div>
              <div className="pt-cell">{p.nextAction ?? "—"}</div>
              <div className="pt-cell">
                <Avatars people={p.responsibles} />
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
