import { useEffect, useMemo, useState } from "react";
import type {
  ConditionStateDTO,
  ConditionStatus,
  DiagnosticDTO,
  MeritGridData,
  MeritResult,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

const RESULT_BADGE: Record<DiagnosticDTO["result"], { cls: string; label: string }> = {
  POR_INICIAR: { cls: "badge-muted", label: "Por iniciar" },
  EM_PREENCHIMENTO: { cls: "badge-warning", label: "Em preenchimento" },
  ELEGIVEL: { cls: "badge-green", label: "Elegível" },
  NAO_ELEGIVEL: { cls: "badge-danger", label: "Não elegível" },
  A_REVER: { cls: "badge-warning", label: "A rever" },
  SEM_GRELHA: { cls: "badge-muted", label: "Sem grelha" },
};

const COND_CYCLE: ConditionStatus[] = ["NA", "PASSA", "FALHA"];
const COND_LABEL: Record<ConditionStatus, string> = {
  NA: "—",
  PASSA: "Passa ✓",
  FALHA: "Falha ✗",
};

export function DiagnosticoTab({
  projectId,
  onAdvanced,
}: {
  projectId: string;
  onAdvanced?: () => void;
}) {
  const { data, loading, error, reload } = useAsync(
    () => api.diagnostic(projectId),
    [projectId],
  );
  const [conditions, setConditions] = useState<ConditionStateDTO[]>([]);
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [regiao, setRegiao] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setConditions(data.conditions);
      setSelection(data.meritSelection);
      setRegiao(data.regiao ?? "");
    }
  }, [data]);

  const gridData = data?.gridData as MeritGridData | null;
  const breakdown = data?.meritBreakdown as MeritResult | null;

  // recálculo local imediato para feedback (o servidor é a fonte de verdade ao guardar)
  const localResult = useMemo(() => breakdown, [breakdown]);

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar diagnóstico…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  function cycleCondition(key: string) {
    setConditions((cs) =>
      cs.map((c) =>
        c.key === key
          ? { ...c, status: COND_CYCLE[(COND_CYCLE.indexOf(c.status) + 1) % 3]! }
          : c,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.saveDiagnostic(projectId, {
        conditions,
        meritSelection: selection,
        regiao: regiao || null,
      });
      reload();
      setMsg("Guardado ✓");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function advance() {
    setSaving(true);
    setMsg(null);
    try {
      await api.advanceDiagnostic(projectId);
      reload();
      onAdvanced?.();
      setMsg("Diagnóstico concluído — pode iniciar a candidatura ✓");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao avançar.");
    } finally {
      setSaving(false);
    }
  }

  const badge = RESULT_BADGE[data.result];

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="section-header">
        <div className="section-title">Diagnóstico A0</div>
        <span className={"badge " + badge.cls}>{badge.label}</span>
      </div>

      {/* ── Condições de acesso ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dp-section-title">Condições de acesso</div>
        {conditions.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Não há condições de acesso configuradas para este aviso.
          </p>
        )}
        {conditions.map((c) => (
          <div
            key={c.key}
            className="cond-row"
            onClick={() => cycleCondition(c.key)}
            title="Clique para alternar"
          >
            <span className="cond-label">{c.label}</span>
            <span
              className={
                "badge " +
                (c.status === "PASSA" ? "badge-green" : c.status === "FALHA" ? "badge-danger" : "badge-muted")
              }
            >
              {COND_LABEL[c.status]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Mérito ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="dp-section-title">Mérito</div>

        {!data.grid && (
          <p style={{ fontSize: 12.5, color: "var(--warning)" }}>
            Grelha não configurada para este aviso. Não é possível calcular a pontuação de mérito.
          </p>
        )}

        {data.grid && gridData && (
          <>
            <p className="login-sub" style={{ marginTop: 0 }}>
              {data.grid.measure} · {data.grid.codigoAviso} · v{data.grid.versao}
              {data.grid.fonteUrl && (
                <>
                  {" · "}
                  <a href={data.grid.fonteUrl} target="_blank" rel="noreferrer" className="folder-link">
                    fonte ↗
                  </a>
                </>
              )}
            </p>

            {data.availableRegions.length > 0 && (
              <div className="merit-sub" style={{ marginBottom: 8 }}>
                <label className="merit-sub-label">
                  Região do investimento (resolve a matriz regional A.1)
                </label>
                <select
                  className="login-input"
                  value={regiao}
                  onChange={(e) => setRegiao(e.target.value)}
                >
                  <option value="">— escolher região —</option>
                  {data.availableRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {gridData.criterios.map((crit) => {
              const cScore = localResult?.criteria.find((x) => x.codigo === crit.codigo);
              return (
                <div key={crit.codigo} className="merit-crit">
                  <div className="merit-crit-head">
                    <b>
                      {crit.codigo}. {crit.nome}
                    </b>
                    <span className="deadline-sub">
                      peso {crit.peso}
                      {cScore ? ` · score ${cScore.score}` : ""}
                      {cScore?.belowMinimum ? " ⚠" : ""}
                    </span>
                  </div>
                  {crit.subcriterios.map((sub) => {
                    const effRegion = regiao || gridData.regiao || "";
                    const opts =
                      sub.options ??
                      (effRegion ? sub.regionalOptions?.[effRegion] : undefined) ??
                      [];
                    return (
                      <div key={sub.codigo} className="merit-sub">
                        <label className="merit-sub-label">
                          {sub.codigo} · {sub.nome}
                        </label>
                        {opts.length === 0 ? (
                          <span className="deadline-sub">
                            (matriz regional — região não definida nesta grelha)
                          </span>
                        ) : (
                          <select
                            className="login-input"
                            value={selection[sub.codigo] ?? ""}
                            onChange={(e) =>
                              setSelection((s) => ({ ...s, [sub.codigo]: Number(e.target.value) }))
                            }
                          >
                            <option value="">— escolher —</option>
                            {opts.map((o, i) => (
                              <option key={i} value={i}>
                                {o.label} ({o.pts})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="merit-total">
              <span>
                MP:{" "}
                <b>
                  {localResult && localResult.missing.length === 0
                    ? localResult.mp.toFixed(2)
                    : "—"}
                </b>{" "}
                / mínimo {data.grid.mpMinimo?.toFixed(2)}
              </span>
              {localResult && localResult.missing.length === 0 && (
                <span className={"badge " + (localResult.passes ? "badge-green" : "badge-danger")}>
                  {localResult.passes ? "Atinge o mínimo" : "Abaixo do mínimo"}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "A guardar…" : "Guardar diagnóstico"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={advance}
          disabled={saving || (data.result !== "ELEGIVEL" && data.result !== "A_REVER")}
          title={
            data.result === "ELEGIVEL" || data.result === "A_REVER"
              ? "Avançar para Candidatura"
              : "Conclua o diagnóstico para avançar"
          }
        >
          Avançar → Candidatura
        </button>
        {msg && <span style={{ fontSize: 12, color: "var(--muted)" }}>{msg}</span>}
      </div>
    </div>
  );
}
