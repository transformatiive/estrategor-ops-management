import { useState } from "react";
import type { AtividadesIndicadoresDTO, IntlAcoesDTO, NovaIntlAcao } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const EMPTY: NovaIntlAcao = { dominio: 1, tipoAcao: "", mercadoPais: "", ano: null };

/** Internacionalização — Ações de intervenção + domínios (TRNSF-960). Só família B. */
export function IntlAcoesPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<IntlAcoesDTO>(() => api.intlAcoes(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [nova, setNova] = useState<NovaIntlAcao>(EMPTY);
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
  const domLabel = (n: number) => data.dominios.find((d) => d.numero === n)?.designacao ?? `Domínio ${n}`;

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Ações de internacionalização (B.8/B.9)</span>
        <span className="deadline-sub">{data.acoes.length} ação(ões)</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Domínios de intervenção</div>
          {data.dominios.map((d) => (
            <div key={d.numero} className="cand-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={d.aplicavel} disabled={busy} onChange={(e) => run(() => api.updateIntlDominio(projectId, d.numero, { aplicavel: e.target.checked }))} />
                <strong>{d.numero}.</strong> {d.designacao}
              </label>
              {d.aplicavel && (
                <input className="login-input" placeholder="Contributo deste domínio" defaultValue={d.contributo ?? ""} onBlur={(e) => run(() => api.updateIntlDominio(projectId, d.numero, { contributo: e.target.value || null }))} />
              )}
            </div>
          ))}

          <div className="cand-section-name" style={{ margin: "14px 0 6px" }}>Lista de ações</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 540 }}>
              <thead><tr><th>Domínio</th><th>Tipo de ação</th><th>Mercado/País</th><th>Ano</th><th></th></tr></thead>
              <tbody>
                {data.acoes.map((a) => (
                  <tr key={a.id}>
                    <td>{domLabel(a.dominio)}</td><td>{a.tipoAcao}</td><td>{a.mercadoPais ?? "—"}</td><td>{a.ano ?? "—"}</td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIntlAcao(projectId, a.id))}>×</button></td>
                  </tr>
                ))}
                {data.acoes.length === 0 && <tr><td colSpan={5} className="cand-empty">Sem ações.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <select className="login-input" style={{ flex: "1 1 180px" }} value={nova.dominio} onChange={(e) => setNova({ ...nova, dominio: Number(e.target.value) })}>
              {data.dominios.map((d) => <option key={d.numero} value={d.numero}>{d.numero}. {d.designacao}</option>)}
            </select>
            <input className="login-input" style={{ flex: "1 1 120px" }} placeholder="Tipo de ação" value={nova.tipoAcao} onChange={(e) => setNova({ ...nova, tipoAcao: e.target.value })} />
            <input className="login-input" style={{ flex: "1 1 100px" }} placeholder="Mercado/País" value={nova.mercadoPais ?? ""} onChange={(e) => setNova({ ...nova, mercadoPais: e.target.value })} />
            <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Ano" value={nova.ano ?? ""} onChange={(e) => setNova({ ...nova, ano: e.target.value === "" ? null : Number(e.target.value) })} />
            <button className="btn btn-primary" disabled={busy || !nova.tipoAcao} onClick={() => run(async () => { await api.addIntlAcao(projectId, nova); setNova(EMPTY); })}>Adicionar</button>
          </div>
          <p className="deadline-sub" style={{ marginTop: 4 }}>O detalhe de cada ação (custos, deslocações) está na secção seguinte.</p>

          <IntlIndicadores projectId={projectId} onChanged={onChanged} />
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

/** Indicadores (códigos do catálogo) — alimentam o MP (946). Reusa os endpoints. */
function IntlIndicadores({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, reload } = useAsync<AtividadesIndicadoresDTO>(() => api.atividades(projectId), [projectId]);
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const catLabel = (codigo: string) => data.catalogo.find((c) => c.codigo === codigo)?.designacao ?? codigo;
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); reload(); onChanged(); } finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 14 }}>
      <div className="cand-section-name" style={{ marginBottom: 6 }}>Indicadores</div>
      <div style={{ overflowX: "auto" }}>
        <table className="fin-table" style={{ minWidth: 480 }}>
          <thead><tr><th>Código</th><th>Indicador</th><th>Pré</th><th>Meta</th><th></th></tr></thead>
          <tbody>
            {data.indicadores.map((i) => (
              <tr key={i.id}>
                <td>{i.codigo}</td><td>{catLabel(i.codigo)}</td>
                <td><input className="fin-cell" type="number" defaultValue={i.valorPre ?? ""} onBlur={(e) => run(() => api.updateIndicador(projectId, i.id, e.target.value === "" ? null : Number(e.target.value), i.valorMeta))} /></td>
                <td><input className="fin-cell" type="number" defaultValue={i.valorMeta ?? ""} onBlur={(e) => run(() => api.updateIndicador(projectId, i.id, i.valorPre, e.target.value === "" ? null : Number(e.target.value)))} /></td>
                <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIndicador(projectId, i.id))}>×</button></td>
              </tr>
            ))}
            {data.indicadores.length === 0 && <tr><td colSpan={5} className="cand-empty">Sem indicadores.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <select className="login-input" style={{ flex: "1 1 240px" }} value={novo} onChange={(e) => setNovo(e.target.value)}>
          <option value="">Adicionar indicador do catálogo…</option>
          {data.catalogo.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.designacao}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy || !novo} onClick={() => run(async () => { await api.addIndicador(projectId, novo); setNovo(""); })}>Adicionar</button>
      </div>
    </div>
  );
}
