import {
  PROJECT_STATE_LABELS,
  type ProjectState,
} from "@estrategor/shared";

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
