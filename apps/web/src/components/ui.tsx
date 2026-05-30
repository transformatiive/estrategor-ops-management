import {
  PROJECT_STATE_LABELS,
  type ProjectState,
} from "@estrategor/shared";

/** Estado de erro com botão para repetir (ligação à BD). */
export function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <p>Não foi possível ligar à base de dados.</p>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{error}</p>
      <button className="btn btn-secondary" onClick={onRetry}>
        Repetir
      </button>
    </div>
  );
}

/** Estado vazio genérico. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty">
      <p>{message}</p>
    </div>
  );
}

/** Linhas skeleton para a tabela de projectos durante o carregamento. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="project-table">
      <div className="pt-head">
        <div className="pt-head-cell">Projecto / Cliente</div>
        <div className="pt-head-cell">Programa</div>
        <div className="pt-head-cell">Fase</div>
        <div className="pt-head-cell">Progresso</div>
        <div className="pt-head-cell">Próxima acção</div>
        <div className="pt-head-cell">Equipa</div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="pt-row" key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <div className="pt-cell" key={j}>
              <div className="skeleton" style={{ height: 12, width: j === 0 ? "80%" : "50%" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Badge do programa, com a cor do protótipo por código. */
export function ProgramBadge({ program }: { program: string }) {
  const variant =
    program === "PT2030"
      ? "badge-blue"
      : program === "RFAI" || program === "SIFIDE"
        ? "badge-purple"
        : "badge-muted";
  return <span className={`badge ${variant}`}>{program}</span>;
}

/** Badge do estado do projeto (A0–B2), com rótulo legível. */
export function StateBadge({ state }: { state: ProjectState }) {
  // execução/encerramento em laranja; aprovado/encerrado em verde; resto neutro
  const variant = state.startsWith("B")
    ? state === "B1"
      ? "badge-warning"
      : "badge-green"
    : "badge-muted";
  return <span className={`badge ${variant}`}>{PROJECT_STATE_LABELS[state]}</span>;
}

/** Barra de progresso. */
export function Progress({ value }: { value: number }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div
          className={"progress-fill" + (value < 50 ? " warn" : "")}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="progress-pct">{value}%</span>
    </div>
  );
}

/** Cluster de avatares dos responsáveis. */
export function Avatars({
  people,
}: {
  people: { initials: string; color: string; fullName: string }[];
}) {
  return (
    <div className="avatar-cluster">
      {people.map((p, i) => (
        <div key={i} className={`avatar-sm av-${p.color}`} title={p.fullName}>
          {p.initials}
        </div>
      ))}
    </div>
  );
}
