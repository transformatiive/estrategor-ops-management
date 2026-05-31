import { useState } from "react";
import type { IntlDetalheDTO, NovaIntlDeslocacao, NovoIntlCusto, NovoIntlRh } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";
import { Dropdown } from "./Dropdown.js";

const eur = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €");

/** Internacionalização — Detalhe da ação (custos/deslocações) + RH (TRNSF-961). Só família B. */
export function IntlDetalhePanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<IntlDetalheDTO>(() => api.intlDetalhe(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [custo, setCusto] = useState<NovoIntlCusto>({ acaoId: "", rubrica: "", montante: null, ano: null });
  const [desl, setDesl] = useState<NovaIntlDeslocacao>({ acaoId: "", pessoa: "", destino: "", dias: null, viagem: null, estadia: null, ajudasCusto: null });
  const [rh, setRh] = useState<NovoIntlRh>({ funcao: "", custo: null, periodo: "" });

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { await fn(); reload(); onChanged(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro."); }
    finally { setBusy(false); }
  }
  const acaoLabel = (id: string) => data.acoes.find((a) => a.id === id)?.label ?? id;
  const rubLabel = (cod: string) => data.rubricas.find((r) => r.codigo === cod)?.designacao ?? cod;
  const semAcoes = data.acoes.length === 0;

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Detalhe das ações (custos/deslocações) + RH (B.10/B.11)</span>
        <span className="deadline-sub">
          {eur(data.totalGlobal)}{data.coincide === false ? " · ⚠️ diverge da financeira" : data.coincide ? " · ✓ coincide" : ""}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {data.coincide === false && (
            <div className="login-error" style={{ marginBottom: 10 }}>
              Total das ações ({eur(data.totalGlobal)}) não coincide com o custo da componente financeira ({eur(data.custoFinanceira)}).
            </div>
          )}
          {semAcoes && <p className="cand-empty">Adicione ações na secção anterior para detalhar custos e deslocações.</p>}

          {/* Custos por ação */}
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Custos das ações ({eur(data.totalCustos)})</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 480 }}>
              <thead><tr><th>Ação</th><th>Rubrica</th><th>Montante</th><th>Ano</th><th></th></tr></thead>
              <tbody>
                {data.custos.map((c) => (
                  <tr key={c.id}><td>{acaoLabel(c.acaoId)}</td><td>{rubLabel(c.rubrica)}</td><td style={{ textAlign: "right" }}>{eur(c.montante)}</td><td>{c.ano ?? "—"}</td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIntlCusto(projectId, c.id))}>×</button></td></tr>
                ))}
                {data.custos.length === 0 && <tr><td colSpan={5} className="cand-empty">Sem custos.</td></tr>}
              </tbody>
            </table>
          </div>
          {!semAcoes && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Dropdown block style={{ flex: "2 1 160px" }} value={custo.acaoId} onChange={(v) => setCusto({ ...custo, acaoId: v })} placeholder="Ação…" options={data.acoes.map((a) => ({ value: a.id, label: a.label }))} />
              <Dropdown block style={{ flex: "1 1 130px" }} value={custo.rubrica} onChange={(v) => setCusto({ ...custo, rubrica: v })} placeholder="Rubrica…" options={data.rubricas.map((r) => ({ value: r.codigo, label: r.designacao }))} />
              <input className="login-input" style={{ flex: "1 1 90px" }} type="number" placeholder="Montante" value={custo.montante ?? ""} onChange={(e) => setCusto({ ...custo, montante: e.target.value === "" ? null : Number(e.target.value) })} />
              <input className="login-input" style={{ flex: "0 1 70px" }} type="number" placeholder="Ano" value={custo.ano ?? ""} onChange={(e) => setCusto({ ...custo, ano: e.target.value === "" ? null : Number(e.target.value) })} />
              <button className="btn btn-primary" disabled={busy || !custo.acaoId || !custo.rubrica} onClick={() => run(async () => { await api.addIntlCusto(projectId, custo); setCusto({ acaoId: "", rubrica: "", montante: null, ano: null }); })}>+ Custo</button>
            </div>
          )}

          {/* Deslocações */}
          <div className="cand-section-name" style={{ margin: "14px 0 6px" }}>Deslocações ({eur(data.totalDeslocacoes)})</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 560 }}>
              <thead><tr><th>Ação</th><th>Pessoa</th><th>Destino</th><th>Dias</th><th>Viagem</th><th>Estadia</th><th>Ajudas</th><th></th></tr></thead>
              <tbody>
                {data.deslocacoes.map((d) => (
                  <tr key={d.id}><td>{acaoLabel(d.acaoId)}</td><td>{d.pessoa}</td><td>{d.destino ?? "—"}</td><td>{d.dias ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{eur(d.viagem)}</td><td style={{ textAlign: "right" }}>{eur(d.estadia)}</td><td style={{ textAlign: "right" }}>{eur(d.ajudasCusto)}</td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIntlDeslocacao(projectId, d.id))}>×</button></td></tr>
                ))}
                {data.deslocacoes.length === 0 && <tr><td colSpan={8} className="cand-empty">Sem deslocações.</td></tr>}
              </tbody>
            </table>
          </div>
          {!semAcoes && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <Dropdown block style={{ flex: "2 1 140px" }} value={desl.acaoId} onChange={(v) => setDesl({ ...desl, acaoId: v })} placeholder="Ação…" options={data.acoes.map((a) => ({ value: a.id, label: a.label }))} />
              <input className="login-input" style={{ flex: "1 1 100px" }} placeholder="Pessoa" value={desl.pessoa} onChange={(e) => setDesl({ ...desl, pessoa: e.target.value })} />
              <input className="login-input" style={{ flex: "1 1 90px" }} placeholder="Destino" value={desl.destino ?? ""} onChange={(e) => setDesl({ ...desl, destino: e.target.value })} />
              <input className="login-input" style={{ flex: "0 1 60px" }} type="number" placeholder="Dias" value={desl.dias ?? ""} onChange={(e) => setDesl({ ...desl, dias: e.target.value === "" ? null : Number(e.target.value) })} />
              <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Viagem" value={desl.viagem ?? ""} onChange={(e) => setDesl({ ...desl, viagem: e.target.value === "" ? null : Number(e.target.value) })} />
              <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Estadia" value={desl.estadia ?? ""} onChange={(e) => setDesl({ ...desl, estadia: e.target.value === "" ? null : Number(e.target.value) })} />
              <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Ajudas" value={desl.ajudasCusto ?? ""} onChange={(e) => setDesl({ ...desl, ajudasCusto: e.target.value === "" ? null : Number(e.target.value) })} />
              <button className="btn btn-primary" disabled={busy || !desl.acaoId || !desl.pessoa} onClick={() => run(async () => { await api.addIntlDeslocacao(projectId, desl); setDesl({ acaoId: "", pessoa: "", destino: "", dias: null, viagem: null, estadia: null, ajudasCusto: null }); })}>+ Deslocação</button>
            </div>
          )}

          {/* RH a contratar */}
          <div className="cand-section-name" style={{ margin: "14px 0 6px" }}>RH a contratar ({eur(data.totalRh)})</div>
          {data.rh.map((r) => (
            <div className="cand-field" key={r.id}>
              <span className="cand-field-key">{r.funcao} · {eur(r.custo)} · {r.periodo ?? "—"}</span>
              <button className="back-link" disabled={busy} onClick={() => run(() => api.deleteIntlRh(projectId, r.id))}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <input className="login-input" style={{ flex: "2 1 140px" }} placeholder="Função" value={rh.funcao} onChange={(e) => setRh({ ...rh, funcao: e.target.value })} />
            <input className="login-input" style={{ flex: "1 1 90px" }} type="number" placeholder="Custo" value={rh.custo ?? ""} onChange={(e) => setRh({ ...rh, custo: e.target.value === "" ? null : Number(e.target.value) })} />
            <input className="login-input" style={{ flex: "1 1 90px" }} placeholder="Período" value={rh.periodo ?? ""} onChange={(e) => setRh({ ...rh, periodo: e.target.value })} />
            <button className="btn btn-primary" disabled={busy || !rh.funcao} onClick={() => run(async () => { await api.addIntlRh(projectId, rh); setRh({ funcao: "", custo: null, periodo: "" }); })}>+ RH</button>
          </div>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
