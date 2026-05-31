import { useState } from "react";
import type { AtividadesIndicadoresDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";
import { Dropdown } from "./Dropdown.js";

/** Inovação — Atividades de inovação + Indicadores (TRNSF-956). Só família A. */
export function AtividadesPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<AtividadesIndicadoresDTO>(() => api.atividades(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [novaAtiv, setNovaAtiv] = useState("");
  const [novoInd, setNovoInd] = useState("");
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
  const catLabel = (codigo: string) => data.catalogo.find((c) => c.codigo === codigo)?.designacao ?? codigo;

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Atividades de inovação + Indicadores (A.11/A.12)</span>
        <span className="deadline-sub">{data.atividades.length} atividade(s) · {data.indicadores.length} indicador(es)</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Atividades de inovação</div>
          {data.atividades.map((a) => (
            <div className="cand-field" key={a.id}>
              <span className="cand-field-key">{a.designacao}</span>
              <button className="back-link" disabled={busy} onClick={() => run(() => api.deleteAtividade(projectId, a.id))}>remover</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="login-input" style={{ flex: 1 }} placeholder="Nova atividade de inovação" value={novaAtiv} onChange={(e) => setNovaAtiv(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !novaAtiv} onClick={() => run(async () => { await api.addAtividade(projectId, novaAtiv); setNovaAtiv(""); })}>Adicionar</button>
          </div>
          <p className="deadline-sub" style={{ marginTop: 4 }}>A caracterização de cada atividade gera-se no painel "Minutas de texto".</p>

          <div className="cand-section-name" style={{ margin: "14px 0 6px" }}>Indicadores</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 520 }}>
              <thead><tr><th>Código</th><th>Indicador</th><th>Pré</th><th>Meta</th><th>Un.</th><th>Fonte</th><th></th></tr></thead>
              <tbody>
                {data.indicadores.map((i) => (
                  <tr key={i.id}>
                    <td>{i.codigo}</td>
                    <td>{catLabel(i.codigo)}</td>
                    <td><input className="fin-cell" type="number" defaultValue={i.valorPre ?? ""} onBlur={(e) => run(() => api.updateIndicador(projectId, i.id, e.target.value === "" ? null : Number(e.target.value), i.valorMeta))} /></td>
                    <td><input className="fin-cell" type="number" defaultValue={i.valorMeta ?? ""} onBlur={(e) => run(() => api.updateIndicador(projectId, i.id, i.valorPre, e.target.value === "" ? null : Number(e.target.value)))} /></td>
                    <td>{i.unidade ?? "—"}</td>
                    <td><span className="badge badge-muted">{i.fonte}</span></td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIndicador(projectId, i.id))}>×</button></td>
                  </tr>
                ))}
                {data.indicadores.length === 0 && <tr><td colSpan={7} className="cand-empty">Sem indicadores.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Dropdown block style={{ flex: "1 1 240px" }} value={novoInd} onChange={setNovoInd} placeholder="Adicionar indicador do catálogo…" options={data.catalogo.map((c) => ({ value: c.codigo, label: `${c.codigo} — ${c.designacao}` }))} />
            <button className="btn btn-primary" disabled={busy || !novoInd} onClick={() => run(async () => { await api.addIndicador(projectId, novoInd); setNovoInd(""); })}>Adicionar</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.sugerirIndicadores(projectId))}>Sugerir da financeira</button>
          </div>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
