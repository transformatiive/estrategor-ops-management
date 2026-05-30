import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { NewProjectModal } from "../components/NewProjectModal.js";

export function Projetos() {
  const { data: projects, loading, error, reload } = useAsync(() => api.projects());
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Projectos</div>
          <div className="page-subtitle">
            {projects ? `${projects.length} projectos` : " "}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo projecto
        </button>
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

      {creating && (
        <NewProjectModal
          onClose={() => setCreating(false)}
          onCreated={(id, foldersError) => {
            setCreating(false);
            if (foldersError) {
              // criado, mas pastas falharam — avisa e fica na lista para repetir no separador Documentos
              alert(
                `Projecto criado, mas a criação de pastas falhou:\n${foldersError}\n\nPode repetir no separador Documentos.`,
              );
              reload();
            }
            navigate(`/projetos/${id}`);
          }}
        />
      )}
    </>
  );
}
