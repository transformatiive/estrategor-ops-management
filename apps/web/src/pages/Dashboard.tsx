import { useState } from "react";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import {
  Avatars,
  ErrorState,
  Progress,
  ProgramBadge,
  StateBadge,
  TableSkeleton,
} from "../components/ui.js";
import { ProjectDrawer } from "../components/ProjectDrawer.js";

export function Dashboard() {
  const { data: projects, loading, error, reload } = useAsync(() => api.projects());
  const { data: health } = useAsync(() => api.health());
  const [selected, setSelected] = useState<string | null>(null);

  const list = projects ?? [];
  const emExecucao = list.filter((p) => p.state === "B1");
  const comAccao = list.filter((p) => p.nextAction).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bom dia, Joana 👋</div>
          <div className="page-subtitle">
            {list.length} projectos · base de dados{" "}
            {health ? (health.db === "up" ? "ligada ✓" : "indisponível ✗") : "…"}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">Projectos activos</div>
          <div className="stat-value">{list.length}</div>
          <div className="stat-sub">no sistema</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Próximas acções</div>
          <div className="stat-value">{comAccao}</div>
          <div className="stat-sub">com prazo definido</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Em execução</div>
          <div className="stat-value">{emExecucao.length}</div>
          <div className="stat-sub">fase B1</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Estado da API</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {health?.status ?? "…"}
          </div>
          <div className="stat-sub">uptime {health?.uptimeSeconds ?? 0}s</div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Projectos em execução</div>
      </div>

      {loading && <TableSkeleton rows={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}

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
          {emExecucao.map((p) => (
            <div className="pt-row" key={p.id} onClick={() => setSelected(p.id)}>
              <div className="pt-cell">
                <div className="proj-name">{p.title}</div>
                <div className="proj-client">{p.clientName}</div>
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
          {emExecucao.length === 0 && <div className="empty">Sem projectos em execução.</div>}
        </div>
      )}

      {selected && <ProjectDrawer id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
