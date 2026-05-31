import { useState } from "react";
import type { TipologiaTipo, TipologiasDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";
import { Dropdown } from "./Dropdown.js";

/** Inovação — Tipologias de investimento (TRNSF-955, A.10). Só família A. */
export function TipologiasPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<TipologiasDTO>(() => api.tipologias(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<TipologiaTipo | "">("");
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

  const label = (t: string) => data.disponiveis.find((d) => d.tipo === t)?.label ?? t;
  const campos = (t: string) => data.disponiveis.find((d) => d.tipo === t)?.campos ?? [];

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Tipologias de investimento (A.10)</span>
        <span className="deadline-sub">{data.linhas.length} tipologia(s){data.issues.length ? ` · ⚠️ ${data.issues.length}` : ""}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {data.issues.length > 0 && (
            <div className="login-error" style={{ marginBottom: 10 }}>
              <strong>Limiares:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {data.issues.map((i, k) => <li key={k}>{label(i.tipo)}: {i.mensagem}</li>)}
              </ul>
            </div>
          )}

          {data.linhas.map((l) => (
            <div className="cand-field" key={l.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div className="cand-field-main">
                <span className="cand-field-key">{label(l.tipo)}</span>
                <button className="back-link" disabled={busy} onClick={() => run(() => api.deleteTipologia(projectId, l.id))}>remover</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {campos(l.tipo).map((c) => (
                  <label key={c.key} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    {c.label}
                    <input
                      className="login-input"
                      style={{ width: 180 }}
                      type={c.tipo === "numero" ? "number" : "text"}
                      defaultValue={(l.dados[c.key] ?? "") as string | number}
                      onBlur={(e) => {
                        const v = c.tipo === "numero" ? Number(e.target.value) : e.target.value;
                        run(() => api.updateTipologia(projectId, l.id, { ...l.dados, [c.key]: v }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <Dropdown block style={{ flex: "1 1 260px" }} value={novo} onChange={(v) => setNovo(v as TipologiaTipo)} placeholder="Adicionar tipologia…" options={data.disponiveis.map((d) => ({ value: d.tipo, label: d.label }))} />
            <button className="btn btn-primary" disabled={busy || !novo} onClick={() => run(async () => { await api.addTipologia(projectId, novo as TipologiaTipo); setNovo(""); })}>Adicionar</button>
          </div>
          <p className="deadline-sub" style={{ marginTop: 6 }}>A fundamentação de cada tipologia gera-se no painel "Minutas de texto".</p>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
