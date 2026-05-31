import { useState } from "react";
import type { DescricaoFisicaDados, InovacaoCondDTO, NovaSubstituicaoLinha } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const EMPTY_SUB: NovaSubstituicaoLinha = { produto: "", mercadoPais: "", valorImportado: null, producaoNacionalPrevista: null };

/** Inovação — Substituição de importações (A.7) + Descrição física (A.15). Só família A. */
export function InovacaoCondPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<InovacaoCondDTO>(() => api.inovacaoCond(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<NovaSubstituicaoLinha>(EMPTY_SUB);
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
  const df = data.descricaoFisica;
  const saveDf = (patch: Partial<DescricaoFisicaDados>) => run(() => api.updateDescricaoFisica(projectId, { ...df, ...patch }));

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Substituição de importações + Descrição física (A.7/A.15)</span>
        <span className="deadline-sub">condicionais · {data.substituicao.length} linha(s)</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Substituição de importações</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 520 }}>
              <thead><tr><th>Produto</th><th>Mercado/País</th><th>Valor importado</th><th>Produção nacional prevista</th><th></th></tr></thead>
              <tbody>
                {data.substituicao.map((s) => (
                  <tr key={s.id}>
                    <td>{s.produto}</td><td>{s.mercadoPais ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.valorImportado ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.producaoNacionalPrevista ?? "—"}</td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteSubstituicao(projectId, s.id))}>×</button></td>
                  </tr>
                ))}
                {data.substituicao.length === 0 && <tr><td colSpan={5} className="cand-empty">Sem linhas.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <input className="login-input" style={{ flex: "2 1 140px" }} placeholder="Produto" value={sub.produto} onChange={(e) => setSub({ ...sub, produto: e.target.value })} />
            <input className="login-input" style={{ flex: "1 1 110px" }} placeholder="Mercado/País" value={sub.mercadoPais ?? ""} onChange={(e) => setSub({ ...sub, mercadoPais: e.target.value })} />
            <input className="login-input" style={{ flex: "1 1 100px" }} type="number" placeholder="V. importado" value={sub.valorImportado ?? ""} onChange={(e) => setSub({ ...sub, valorImportado: e.target.value === "" ? null : Number(e.target.value) })} />
            <input className="login-input" style={{ flex: "1 1 100px" }} type="number" placeholder="Prod. nacional" value={sub.producaoNacionalPrevista ?? ""} onChange={(e) => setSub({ ...sub, producaoNacionalPrevista: e.target.value === "" ? null : Number(e.target.value) })} />
            <button className="btn btn-primary" disabled={busy || !sub.produto} onClick={() => run(async () => { await api.addSubstituicao(projectId, sub); setSub(EMPTY_SUB); })}>Adicionar</button>
          </div>
          <p className="deadline-sub" style={{ marginTop: 4 }}>Liga-se às linhas de mercado (secção Atividade económica por mercado).</p>

          <div className="cand-section-name" style={{ margin: "14px 0 6px" }}>Descrição física (ex.: Turismo)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 520 }}>
            <input className="login-input" placeholder="Instalações" defaultValue={df.instalacoes ?? ""} onBlur={(e) => saveDf({ instalacoes: e.target.value || null })} />
            <input className="login-input" type="number" placeholder="Área (m²)" defaultValue={df.areaM2 ?? ""} onBlur={(e) => saveDf({ areaM2: e.target.value === "" ? null : Number(e.target.value) })} />
            <input className="login-input" placeholder="Tipologia construtiva" defaultValue={df.tipologiaConstrutiva ?? ""} onBlur={(e) => saveDf({ tipologiaConstrutiva: e.target.value || null })} />
            <textarea className="login-input" style={{ minHeight: 70, fontFamily: "inherit" }} placeholder="Notas" defaultValue={df.notas ?? ""} onBlur={(e) => saveDf({ notas: e.target.value || null })} />
          </div>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
