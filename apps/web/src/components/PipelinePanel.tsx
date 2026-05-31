import { computePipeline, type PipelineDTO } from "@estrategor/shared";

/**
 * Pipeline da página de projeto (TRNSF-963): fases por ordem em linguagem de
 * cliente, estado de cada uma, progresso e "o que falta para avançar".
 */
export function PipelinePanel({
  pipe,
  faseSelecionada,
  onSelect,
}: {
  pipe: PipelineDTO;
  faseSelecionada: string;
  onSelect: (faseKey: string) => void;
}) {
  const { passos, progresso } = computePipeline(pipe.faseAtual);

  return (
    <div className="pipeline">
      <div className="pipeline-track">
        {passos.map((p) => {
          const selected = p.key === faseSelecionada;
          const clickable = p.bloco === "candidatura";
          return (
            <button
              key={p.key}
              type="button"
              disabled={!clickable}
              className={`pl-step pl-${p.estado}${selected ? " pl-selected" : ""}`}
              title={p.bloco === "execucao" ? "Fase de execução (se aprovado)" : p.label}
              onClick={() => clickable && onSelect(p.key)}
            >
              <span className="pl-badge">{p.estado === "concluido" ? "✓" : p.numero}</span>
              <span className="pl-label">{p.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pipeline-meta">
        <span className="deadline-sub">{progresso.concluidas} de {progresso.total} fases da candidatura concluídas</span>
      </div>

      {/* O que falta para avançar (fase atual) */}
      {faseSelecionada === pipe.faseAtual && (
        <div className="card pipeline-requisitos">
          <div className="cand-section-name" style={{ marginBottom: 6 }}>O que falta para avançar</div>
          {pipe.nota ? (
            <p className="cand-empty">{pipe.nota}</p>
          ) : pipe.requisitos.length === 0 ? (
            <p className="cand-empty">Sem pré-requisitos para esta fase.</p>
          ) : (
            <ul className="pl-req-list">
              {pipe.requisitos.map((r, i) => (
                <li key={i} className={r.done ? "pl-req-done" : "pl-req-todo"}>
                  {r.done ? "✓" : "○"} {r.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
