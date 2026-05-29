import { useEffect, useState } from "react";
import type { ProjectListItemDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { Avatars, Progress, ProgramBadge, StateBadge } from "../components/ui.js";

export function Projetos() {
  const [projects, setProjects] = useState<ProjectListItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .projects()
      .then(setProjects)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Projectos</div>
          <div className="page-subtitle">
            {projects ? `${projects.length} projectos` : "A carregar…"}
          </div>
        </div>
        <button className="btn btn-primary">+ Novo projecto</button>
      </div>

      {error && <div className="empty">Erro ao carregar projetos: {error}</div>}

      {projects && (
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
            <div className="pt-row" key={p.id}>
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
    </>
  );
}
