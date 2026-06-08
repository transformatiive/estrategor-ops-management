import { useState } from "react";
import { api, ApiError } from "../lib/api.js";

/**
 * Ações de transição da cauda da Candidatura (TRNSF-1067 · 2b): marcar como
 * submetida (Submissão → Análise), registar a decisão (Análise → Execução ou
 * Alegações) e concluir as alegações (Alegações → Execução). Só aparece quando
 * a fase em foco é a fase atual do projeto.
 */
export function FaseAcoesPanel({
  projectId,
  faseAtual,
  onChanged,
}: {
  projectId: string;
  faseAtual: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!["submissao", "analise", "alegacoes"].includes(faseAtual)) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card pipeline-requisitos" style={{ marginTop: 10 }}>
      <div className="cand-section-name" style={{ marginBottom: 6 }}>Ações da fase</div>

      {faseAtual === "submissao" && (
        <>
          <p className="deadline-sub" style={{ marginBottom: 8 }}>
            Depois de submeter o pacote no portal SGO, marque a candidatura como submetida — passa a acompanhar a Análise pelo organismo.
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.submeterCandidatura(projectId))}>
            Marcar como submetida
          </button>
        </>
      )}

      {faseAtual === "analise" && (
        <>
          <p className="deadline-sub" style={{ marginBottom: 8 }}>
            Registe a decisão do organismo. Se favorável, segue para a Execução (Termo de aceitação); com cortes ou indeferida, segue para as Alegações contrárias.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.registarDecisao(projectId, "favoravel"))}>
              Favorável → Execução
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.registarDecisao(projectId, "cortes"))}>
              Com cortes → Alegações
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.registarDecisao(projectId, "indeferida"))}>
              Indeferida → Alegações
            </button>
          </div>
        </>
      )}

      {faseAtual === "alegacoes" && (
        <>
          <p className="deadline-sub" style={{ marginBottom: 8 }}>
            Concluídas as alegações contrárias, o projeto segue para a Execução (Termo de aceitação).
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.concluirAlegacoes(projectId))}>
            Alegações concluídas → Execução
          </button>
        </>
      )}

      {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
