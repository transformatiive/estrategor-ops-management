import { useState } from "react";
import type { FinanceiroDTO, RubricaLinhaDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const fmt = (n: number, unidade?: string) =>
  unidade === "rácio" ? n.toFixed(2) : n.toLocaleString("pt-PT", { maximumFractionDigits: 0 });

/**
 * Componente Financeira (TRNSF-944): tabelas balanço/DR/financiamento por
 * rubrica × ano (inputs editáveis, computed só-leitura), indicadores calculados
 * e avisos de coerência (incl. GAF × A0).
 */
export function FinanceiroPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<FinanceiroDTO>(
    () => api.financeiro(projectId),
    [projectId],
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const semDados = data.anos.length === 0;

  async function action(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      reload();
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Componente financeira</span>
        <span className="deadline-sub">
          {semDados ? "sem dados" : `${data.anos.length} ano(s)`}
          {data.coherence.length > 0 ? ` · ⚠️ ${data.coherence.length} incoerência(s)` : ""}
          {data.inputsValidados ? " · validado" : ""}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="cand-actions" style={{ marginBottom: 10 }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => action(() => api.seedFinanceiro(projectId), "Semeado da extração.")}>
              Semear da extração (IES)
            </button>
            {!semDados && !data.inputsValidados && (
              <button className="btn btn-primary" disabled={busy} onClick={() => action(() => api.validarFinanceiro(projectId), "Inputs validados.")}>
                Validar históricos
              </button>
            )}
          </div>
          {msg && <div className="login-error" style={{ marginBottom: 10 }}>{msg}</div>}

          {data.coherence.length > 0 && (
            <div className="login-error" style={{ marginBottom: 10 }}>
              <strong>Incoerências (a resolver):</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {data.coherence.map((c, i) => <li key={i}>{c.mensagem}</li>)}
              </ul>
            </div>
          )}

          {semDados ? (
            <p className="cand-empty">
              Sem dados financeiros. Use <strong>Semear da extração</strong> (depois de validar a extração da IES)
              ou preencha as rubricas manualmente.
            </p>
          ) : (
            <>
              <Tabela titulo="Balanço" linhas={data.balanco} anos={data.anos} mapa="balanco" projectId={projectId} onSaved={() => { reload(); onChanged(); }} />
              <Tabela titulo="Demonstração de resultados" linhas={data.dr} anos={data.anos} mapa="dr" projectId={projectId} onSaved={() => { reload(); onChanged(); }} />
              <Tabela titulo="Financiamento" linhas={data.financiamento} anos={data.anos} mapa="financiamento" projectId={projectId} onSaved={() => { reload(); onChanged(); }} />

              <div style={{ marginTop: 14 }}>
                <div className="cand-section-name" style={{ marginBottom: 6 }}>Indicadores (calculados)</div>
                <div style={{ overflowX: "auto" }}>
                  <table className="fin-table">
                    <thead>
                      <tr><th>Indicador</th>{data.anos.map((a) => <th key={a}>{a}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.indicadores.map((ind) => (
                        <tr key={ind.key}>
                          <td>{ind.label}</td>
                          {data.anos.map((a) => {
                            const v = ind.valores[String(a)];
                            return <td key={a} style={{ textAlign: "right" }}>{v == null ? "—" : fmt(v, ind.unidade)}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="deadline-sub" style={{ marginTop: 10 }}>{data.gaf.nota}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Tabela({
  titulo,
  linhas,
  anos,
  mapa,
  projectId,
  onSaved,
}: {
  titulo: string;
  linhas: RubricaLinhaDTO[];
  anos: number[];
  mapa: string;
  projectId: string;
  onSaved: () => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="cand-section-name" style={{ marginBottom: 6 }}>{titulo}</div>
      <div style={{ overflowX: "auto" }}>
        <table className="fin-table">
          <thead>
            <tr><th>Rubrica</th>{anos.map((a) => <th key={a}>{a}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.key} className={l.kind === "computed" ? "fin-computed" : undefined}>
                <td>{l.label}</td>
                {anos.map((a) => (
                  <td key={a} style={{ textAlign: "right" }}>
                    {l.kind === "computed" ? (
                      <span>{fmt(l.valores[String(a)] ?? 0, l.key === "autonomia_financeira" ? "rácio" : undefined)}</span>
                    ) : (
                      <CellInput
                        value={l.valores[String(a)] ?? 0}
                        onCommit={async (v) => {
                          await api.updateFinanceiroCell(projectId, mapa, l.key, a, v);
                          onSaved();
                        }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CellInput({ value, onCommit }: { value: number; onCommit: (v: number) => Promise<void> }) {
  const [v, setV] = useState(String(value));
  const [busy, setBusy] = useState(false);
  return (
    <input
      className="fin-cell"
      value={v}
      disabled={busy}
      onChange={(e) => setV(e.target.value)}
      onBlur={async () => {
        const n = Number(v.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n) || n === value) { setV(String(value)); return; }
        setBusy(true);
        try { await onCommit(n); } finally { setBusy(false); }
      }}
    />
  );
}
