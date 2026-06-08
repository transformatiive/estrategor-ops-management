import { useState } from "react";
import type { NaoConformidade, VerificacaoDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const EIXO_LABEL: Record<string, string> = { formulario: "Formulário", merito: "Mérito", coerencia: "Coerência" };

/**
 * Verificador + Cálculo de Mérito (TRNSF-946): "Verificar" devolve
 * não-conformidades (formulário/mérito/coerência) e o MP previsto. Inclui a
 * vista "Critérios de seleção" (A/B/C/D), só-de-leitura do mérito calculado.
 */
export function VerificadorPanel({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<VerificacaoDTO>(() => api.verificacao(projectId), [projectId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  async function verificar() {
    setBusy(true);
    setMsg(null);
    setOk(null);
    try {
      const r = await api.verificar(projectId);
      // Feedback explícito: sem isto, uma verificação determinística que dá o
      // mesmo resultado re-renderizava igual e parecia "não fazer nada".
      const nErros = r.naoConformidades.filter((n) => n.gravidade === "erro").length;
      const nAvisos = r.naoConformidades.filter((n) => n.gravidade === "aviso").length;
      setOk(
        nErros === 0 && nAvisos === 0
          ? "✓ Verificação concluída — sem não-conformidades."
          : `✓ Verificação concluída — ${nErros} erro(s), ${nAvisos} aviso(s).`,
      );
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao verificar.");
    } finally {
      setBusy(false);
    }
  }

  const erros = data.naoConformidades.filter((n) => n.gravidade === "erro");
  const avisos = data.naoConformidades.filter((n) => n.gravidade === "aviso");
  const byEixo = (eixo: string) => data.naoConformidades.filter((n) => n.eixo === eixo);

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head">
        <span className="cand-section-name">Verificador + Mérito</span>
        <button className="btn btn-primary" disabled={busy} onClick={verificar}>Verificar</button>
      </div>

      {/* Mérito previsto */}
      <div className="cand-summary" style={{ marginTop: 8, flexWrap: "wrap", gap: 14 }}>
        <span>
          MP previsto:{" "}
          <strong>{data.mpPrevisto == null ? "—" : data.mpPrevisto.toFixed(2)}</strong>
          {data.mpMinimo != null && <span className="deadline-sub"> (mínimo {data.mpMinimo})</span>}
        </span>
        {data.atingeMinimo != null && (
          <span className={"badge " + (data.atingeMinimo ? "badge-muted" : "badge-warning")}>
            {data.atingeMinimo ? "✓ atinge o mínimo" : "abaixo do mínimo"}
          </span>
        )}
        {data.resultado === "sem_grelha" && <span className="badge badge-warning">sem grelha — conclua o A0</span>}
        {data.criadoEm && <span className="deadline-sub">última verificação: {new Date(data.criadoEm).toLocaleString("pt-PT")}</span>}
      </div>
      {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
      {ok && <div className="deadline-sub" style={{ marginTop: 8, color: "var(--green, #16a34a)" }}>{ok}</div>}

      {/* Critérios de seleção (A.20 / B.16) — vista só-de-leitura do mérito */}
      {data.mpPorCriterio.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="cand-section-name" style={{ marginBottom: 6 }}>Critérios de seleção (vista do mérito)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 360 }}>
              <thead><tr><th>Critério</th><th>Peso</th><th>Pontuação</th></tr></thead>
              <tbody>
                {data.mpPorCriterio.map((c) => (
                  <tr key={c.codigo} className={c.belowMinimum ? undefined : undefined}>
                    <td>{c.codigo} — {c.nome}</td>
                    <td style={{ textAlign: "right" }}>{c.peso}</td>
                    <td style={{ textAlign: "right", color: c.belowMinimum ? "var(--danger, #c0392b)" : undefined }}>{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Não-conformidades por eixo */}
      <div style={{ marginTop: 12 }}>
        {data.criadoEm == null ? (
          <p className="cand-empty">Ainda não verificado. Clique em <strong>Verificar</strong>.</p>
        ) : data.naoConformidades.length === 0 ? (
          <p className="badge badge-muted">✓ Sem não-conformidades.</p>
        ) : (
          <>
            <div className="deadline-sub" style={{ marginBottom: 6 }}>{erros.length} não-conformidade(s), {avisos.length} aviso(s)</div>
            {(["formulario", "merito", "coerencia"] as const).map((eixo) => {
              const items = byEixo(eixo);
              if (items.length === 0) return null;
              return (
                <div key={eixo} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{EIXO_LABEL[eixo]}</div>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {items.map((n: NaoConformidade, i) => (
                      <li key={i} style={{ color: n.gravidade === "erro" ? "var(--danger, #c0392b)" : "var(--muted)", fontSize: 13 }}>
                        {n.mensagem}{n.seccao ? <span className="deadline-sub"> → {n.seccao}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
