import { useState } from "react";
import type { IntakeInovacaoAnswers, IntakeInovacaoDTO, TipologiaTipo } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Dropdown } from "./Dropdown.js";

/**
 * Ramo Inovação do formulário ao cliente (TRNSF-959). Aparece quando o projeto
 * tem candidatura da família Inovação. Recolhe intenções de investimento,
 * tipologias pretendidas, indicadores-meta e contexto — origem='intake'.
 */
export function IntakeInovacao({ token }: { token: string }) {
  const { data, loading } = useAsync<IntakeInovacaoDTO>(() => api.intakeInovacao(token), [token]);
  const [a, setA] = useState<IntakeInovacaoAnswers | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading || !data || !data.aplica) return null;
  const ans = a ?? data.answers;
  const set = (patch: Partial<IntakeInovacaoAnswers>) => setA({ ...ans, ...patch });

  function toggleTip(t: TipologiaTipo) {
    const has = ans.tipologias.includes(t);
    set({ tipologias: has ? ans.tipologias.filter((x) => x !== t) : [...ans.tipologias, t] });
  }

  async function submit() {
    setBusy(true); setMsg(null);
    try { await api.submitIntakeInovacao(token, ans); setDone(true); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro ao enviar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="recolha-ref" style={{ marginTop: 16 }}>
      <div className="recolha-ref-title">Sobre o projeto de investimento</div>
      {done ? (
        <div className="recolha-done">✓ Respostas enviadas. Obrigado!</div>
      ) : (
        <>
          {/* Intenções de investimento */}
          <div className="cand-section-name" style={{ margin: "8px 0 4px" }}>Investimentos que pretende fazer</div>
          {ans.intencoes.map((it, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              <input className="login-input" style={{ flex: "2 1 140px" }} placeholder="Designação" value={it.designacao} onChange={(e) => { const n = [...ans.intencoes]; n[i] = { ...it, designacao: e.target.value }; set({ intencoes: n }); }} />
              <Dropdown block style={{ flex: "1 1 120px" }} value={it.categoria} onChange={(v) => { const n = [...ans.intencoes]; n[i] = { ...it, categoria: v }; set({ intencoes: n }); }} placeholder="Categoria…" options={data.categorias.map((c) => ({ value: c.codigo, label: c.designacao }))} />
              <input className="login-input" style={{ flex: "1 1 90px" }} type="number" placeholder="Montante €" value={it.montante ?? ""} onChange={(e) => { const n = [...ans.intencoes]; n[i] = { ...it, montante: e.target.value === "" ? null : Number(e.target.value) }; set({ intencoes: n }); }} />
              <input className="login-input" style={{ flex: "0 1 80px" }} type="number" placeholder="Ano" value={it.ano ?? ""} onChange={(e) => { const n = [...ans.intencoes]; n[i] = { ...it, ano: e.target.value === "" ? null : Number(e.target.value) }; set({ intencoes: n }); }} />
              <button className="back-link" onClick={() => set({ intencoes: ans.intencoes.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <button className="btn btn-secondary" onClick={() => set({ intencoes: [...ans.intencoes, { designacao: "", categoria: "", montante: null, ano: null }] })}>+ Linha de investimento</button>

          {/* Tipologias pretendidas */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Tipologias pretendidas</div>
          {data.tipologias.map((t) => (
            <label key={t.tipo} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 3 }}>
              <input type="checkbox" checked={ans.tipologias.includes(t.tipo)} onChange={() => toggleTip(t.tipo)} /> {t.label}
            </label>
          ))}

          {/* Indicadores-meta */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Metas do projeto</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input className="login-input" style={{ flex: "1 1 120px" }} type="number" placeholder="Emprego (ETI)" value={ans.indicadoresMeta.emprego ?? ""} onChange={(e) => set({ indicadoresMeta: { ...ans.indicadoresMeta, emprego: e.target.value === "" ? null : Number(e.target.value) } })} />
            <input className="login-input" style={{ flex: "1 1 120px" }} type="number" placeholder="Volume de negócios €" value={ans.indicadoresMeta.volumeNegocios ?? ""} onChange={(e) => set({ indicadoresMeta: { ...ans.indicadoresMeta, volumeNegocios: e.target.value === "" ? null : Number(e.target.value) } })} />
            <input className="login-input" style={{ flex: "1 1 120px" }} type="number" placeholder="Capacidade" value={ans.indicadoresMeta.capacidade ?? ""} onChange={(e) => set({ indicadoresMeta: { ...ans.indicadoresMeta, capacidade: e.target.value === "" ? null : Number(e.target.value) } })} />
          </div>

          {/* Contexto */}
          <div className="cand-section-name" style={{ margin: "12px 0 4px" }}>Contexto</div>
          <textarea className="login-input" style={{ minHeight: 60, fontFamily: "inherit", marginBottom: 6 }} placeholder="Motivação do projeto" value={ans.contexto.motivacao ?? ""} onChange={(e) => set({ contexto: { ...ans.contexto, motivacao: e.target.value || null } })} />
          <textarea className="login-input" style={{ minHeight: 60, fontFamily: "inherit" }} placeholder="Mercado-alvo" value={ans.contexto.mercadoAlvo ?? ""} onChange={(e) => set({ contexto: { ...ans.contexto, mercadoAlvo: e.target.value || null } })} />

          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
          <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={submit}>Enviar respostas</button>
        </>
      )}
    </div>
  );
}
