import { useState } from "react";
import { INDUSTRIA40_AMBITOS, INDUSTRIA40_LABELS, type InovacaoExtraDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/** Inovação — Indústria 4.0 + Transição Climática (TRNSF-957). Só família A. */
export function InovacaoExtraPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<InovacaoExtraDTO>(() => api.inovacaoExtra(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [tc, setTc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { await fn(); reload(); onChanged(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Indústria 4.0 + Transição Climática (A.16/A.17)</span>
        <span className="deadline-sub">condicionais</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Indústria 4.0 — âmbitos aplicáveis</div>
          {INDUSTRIA40_AMBITOS.map((a) => (
            <label key={a} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={data.industria40.ambitos[a]}
                disabled={busy}
                onChange={(e) => run(() => api.updateInovacaoExtra(projectId, { industria40Ambitos: { [a]: e.target.checked } }))}
              />
              {INDUSTRIA40_LABELS[a]}
            </label>
          ))}
          <p className="deadline-sub">O texto de cada âmbito gera-se no painel "Minutas de texto".</p>

          <div className="cand-section-name" style={{ margin: "12px 0 6px" }}>Transição Climática — âmbitos</div>
          {data.transicaoClimatica.temIndicadoresRpa && (
            <div className="login-error" style={{ marginBottom: 8 }}>
              Há indicadores RPA — a fundamentação dos indicadores RPA é obrigatória (gere-a no painel "Minutas de texto").
            </div>
          )}
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            {data.transicaoClimatica.ambitos.map((a, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                {a}{" "}
                <button className="back-link" disabled={busy} onClick={() => run(() => api.updateInovacaoExtra(projectId, { transicaoAmbitos: data.transicaoClimatica.ambitos.filter((_, k) => k !== i) }))}>×</button>
              </li>
            ))}
            {data.transicaoClimatica.ambitos.length === 0 && <li className="cand-empty">Sem âmbitos.</li>}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="login-input" style={{ flex: 1 }} placeholder="Âmbito de transição climática" value={tc} onChange={(e) => setTc(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !tc} onClick={() => run(async () => { await api.updateInovacaoExtra(projectId, { transicaoAmbitos: [...data.transicaoClimatica.ambitos, tc] }); setTc(""); })}>Adicionar</button>
          </div>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
