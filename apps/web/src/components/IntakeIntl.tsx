import { useState } from "react";
import type { IntakeIntlAnswers, IntakeIntlDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Dropdown } from "./Dropdown.js";

/**
 * Ramo Internacionalização do formulário ao cliente (TRNSF-962). Aparece quando
 * o projeto tem candidatura de Internacionalização. Recolhe ações por evento/
 * país, mercados-alvo, RH a contratar, certificações e estratégia.
 */
export function IntakeIntl({ token }: { token: string }) {
  const { data, loading } = useAsync<IntakeIntlDTO>(() => api.intakeIntl(token), [token]);
  const [a, setA] = useState<IntakeIntlAnswers | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [merc, setMerc] = useState("");
  const [cert, setCert] = useState("");

  if (loading || !data || !data.aplica) return null;
  const ans = a ?? data.answers;
  const set = (patch: Partial<IntakeIntlAnswers>) => setA({ ...ans, ...patch });

  async function submit() {
    setBusy(true); setMsg(null);
    try { await api.submitIntakeIntl(token, ans); setDone(true); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro ao enviar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="recolha-ref" style={{ marginTop: 16 }}>
      <div className="recolha-ref-title">Sobre o plano de internacionalização</div>
      {done ? (
        <div className="recolha-done">✓ Respostas enviadas. Obrigado!</div>
      ) : (
        <>
          {/* Ações por evento/país */}
          <div className="cand-section-name" style={{ margin: "8px 0 4px" }}>Ações / eventos previstos</div>
          {ans.acoes.map((it, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              <input className="login-input" style={{ flex: "2 1 140px" }} placeholder="Designação (feira/evento)" value={it.designacao} onChange={(e) => { const n = [...ans.acoes]; n[i] = { ...it, designacao: e.target.value }; set({ acoes: n }); }} />
              <Dropdown block style={{ flex: "1 1 160px" }} value={String(it.dominio)} onChange={(v) => { const n = [...ans.acoes]; n[i] = { ...it, dominio: Number(v) }; set({ acoes: n }); }} options={data.dominios.map((d) => ({ value: String(d.numero), label: `${d.numero}. ${d.designacao}` }))} />
              <input className="login-input" style={{ flex: "1 1 100px" }} placeholder="Mercado/País" value={it.mercadoPais ?? ""} onChange={(e) => { const n = [...ans.acoes]; n[i] = { ...it, mercadoPais: e.target.value }; set({ acoes: n }); }} />
              <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Ano" value={it.ano ?? ""} onChange={(e) => { const n = [...ans.acoes]; n[i] = { ...it, ano: e.target.value === "" ? null : Number(e.target.value) }; set({ acoes: n }); }} />
              <button className="back-link" onClick={() => set({ acoes: ans.acoes.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={() => set({ acoes: [...ans.acoes, { designacao: "", dominio: data.dominios[0]?.numero ?? 1, mercadoPais: "", ano: null }] })}>+ Ação</button>

          {/* Mercados-alvo */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Mercados-alvo prioritários</div>
          <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
            {ans.mercadosAlvo.map((m, i) => <li key={i} style={{ fontSize: 13 }}>{m} <button className="back-link" onClick={() => set({ mercadosAlvo: ans.mercadosAlvo.filter((_, k) => k !== i) })}>×</button></li>)}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="login-input" style={{ flex: 1 }} placeholder="País/mercado" value={merc} onChange={(e) => setMerc(e.target.value)} />
            <button className="btn btn-secondary" disabled={!merc} onClick={() => { set({ mercadosAlvo: [...ans.mercadosAlvo, merc] }); setMerc(""); }}>Adicionar</button>
          </div>

          {/* Certificações */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Certificações pretendidas</div>
          <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
            {ans.certificacoes.map((m, i) => <li key={i} style={{ fontSize: 13 }}>{m} <button className="back-link" onClick={() => set({ certificacoes: ans.certificacoes.filter((_, k) => k !== i) })}>×</button></li>)}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="login-input" style={{ flex: 1 }} placeholder="Certificação" value={cert} onChange={(e) => setCert(e.target.value)} />
            <button className="btn btn-secondary" disabled={!cert} onClick={() => { set({ certificacoes: [...ans.certificacoes, cert] }); setCert(""); }}>Adicionar</button>
          </div>

          {/* RH a contratar */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>RH a contratar</div>
          {ans.rh.map((r, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              <input className="login-input" style={{ flex: "2 1 140px" }} placeholder="Função" value={r.funcao} onChange={(e) => { const n = [...ans.rh]; n[i] = { ...r, funcao: e.target.value }; set({ rh: n }); }} />
              <input className="login-input" style={{ flex: "1 1 90px" }} type="number" placeholder="Custo" value={r.custo ?? ""} onChange={(e) => { const n = [...ans.rh]; n[i] = { ...r, custo: e.target.value === "" ? null : Number(e.target.value) }; set({ rh: n }); }} />
              <input className="login-input" style={{ flex: "1 1 90px" }} placeholder="Período" value={r.periodo ?? ""} onChange={(e) => { const n = [...ans.rh]; n[i] = { ...r, periodo: e.target.value }; set({ rh: n }); }} />
              <button className="back-link" onClick={() => set({ rh: ans.rh.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={() => set({ rh: [...ans.rh, { funcao: "", custo: null, periodo: "" }] })}>+ RH</button>

          {/* Estratégia */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Estratégia de internacionalização</div>
          <textarea className="login-input" style={{ minHeight: 70, fontFamily: "inherit" }} value={ans.contexto.estrategia ?? ""} onChange={(e) => set({ contexto: { estrategia: e.target.value || null } })} />

          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
          <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={submit}>Enviar respostas</button>
        </>
      )}
    </div>
  );
}
