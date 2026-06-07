import { useEffect, useMemo, useState } from "react";
import {
  canManageUsers,
  type CondSugestao,
  type ConditionStateDTO,
  type ConditionStatus,
  type DiagnosticDTO,
  type MeritGridData,
  type MeritResult,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { useAuth } from "../lib/auth.js";
import { ErrorState } from "./ui.js";
import { Dropdown } from "./Dropdown.js";
import { PreDiagnosticoPanel } from "./PreDiagnosticoPanel.js";
import { AvisoElegibilidadeEditor } from "./AvisoElegibilidadeEditor.js";

/** Badge da sugestão da pré-análise das condições (TRNSF-1029/1030). */
const SUG_BADGE: Record<CondSugestao, { cls: string; label: string }> = {
  provavel_passa: { cls: "badge-green", label: "Provável PASSA · a confirmar" },
  provavel_falha: { cls: "badge-danger", label: "Provável FALHA · a confirmar" },
  indicio: { cls: "badge-blue", label: "Indício" },
  sem_dados: { cls: "badge-muted", label: "Sem dados — confirmar" },
};

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
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => api.diagnostic(projectId),
    [projectId],
  );
  const [conditions, setConditions] = useState<ConditionStateDTO[]>([]);
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [regiao, setRegiao] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setConditions(data.conditions);
      // Pré-preenche com a proposta da IA (por validar) quando existe, sobre a
      // selecção do consultor — fica editável; Guardar é o que conta.
      const proposta = data.meritProposal?.selection ?? {};
      setSelection({ ...data.meritSelection, ...proposta });
      // Pré-preenche a região: a do consultor quando existe; senão a sugerida a
      // partir da localização validada da empresa (TRNSF-1042). Fica editável.
      setRegiao(data.regiao || data.regiaoSugerida || "");
    }
  }, [data]);

  const gridData = data?.gridData as MeritGridData | null;
  const breakdown = data?.meritBreakdown as MeritResult | null;
  const meritProposal = data?.meritProposal ?? null;

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

  // TRNSF-1035 — aplica os "Provável PASSA/FALHA" determinísticos ao estado das
  // condições, para o consultor REVER e confirmar (Guardar). Nunca decide
  // sozinho: as que não têm sugestão determinística ficam como estão.
  function aplicarSugestoes() {
    setConditions((cs) =>
      cs.map((c) =>
        c.sugestao === "provavel_passa"
          ? { ...c, status: "PASSA" as ConditionStatus }
          : c.sugestao === "provavel_falha"
            ? { ...c, status: "FALHA" as ConditionStatus }
            : c,
      ),
    );
    setMsg("Sugestões aplicadas — reveja e guarde.");
  }

  async function escolherAviso(meritGridId: string) {
    if (!meritGridId) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.setAviso(projectId, meritGridId);
      reload();
      setMsg("Aviso associado ✓");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao associar o aviso.");
    } finally {
      setSaving(false);
    }
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

  async function sugerirMerito() {
    setSugerindo(true);
    setMsg(null);
    try {
      await api.sugerirMerito(projectId);
      reload();
      setMsg("Pontuação proposta pela IA — reveja, ajuste e guarde.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao sugerir pontuação.");
    } finally {
      setSugerindo(false);
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
  const nSugestoes = conditions.filter(
    (c) => c.sugestao === "provavel_passa" || c.sugestao === "provavel_falha",
  ).length;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="section-header">
        <div className="section-title">Diagnóstico A0</div>
        <span className={"badge " + badge.cls}>{badge.label}</span>
      </div>

      {/* ── Aviso do projeto (TRNSF-1031): escolha explícita = certeza ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="dp-section-title" style={{ marginBottom: 0 }}>Aviso do projeto</div>
          <span className={"badge " + (data.avisoConfirmado ? "badge-green" : "badge-warning")}>
            {data.avisoConfirmado ? "Confirmado ✓" : "Por confirmar"}
          </span>
        </div>
        <p className="deadline-sub" style={{ margin: "6px 0 10px" }}>
          A elegibilidade (CAE/regiões) é por aviso. Escolha o aviso concreto deste projeto — é o que garante que o cliente é avaliado contra as regras certas.
        </p>
        {data.avisos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Não há avisos configurados para este programa ainda.
          </p>
        ) : (
          <Dropdown
            block
            value={data.selectedGridId ?? ""}
            onChange={(v) => escolherAviso(v)}
            options={[
              ...(data.avisoConfirmado ? [] : [{ value: "", label: "— Escolha o aviso —" }]),
              ...data.avisos.map((a) => ({
                value: a.id,
                label: `${a.codigoAviso} · ${a.measure}${a.regiao ? ` · ${a.regiao}` : ""} · v${a.versao}${
                  a.eligibilidadeEstado === "validado" ? " · elegibilidade ✓" : a.eligibilidadeEstado === "por_validar" ? " · elegibilidade por validar" : ""
                }`,
              })),
            ]}
          />
        )}
        {!data.avisoConfirmado && data.avisos.length > 0 && (
          <p className="login-error" style={{ marginTop: 8 }}>
            Sugestão automática (não confirmada). Confirme o aviso para concluir o diagnóstico.
          </p>
        )}
      </div>

      {/* ── Pré-diagnóstico assistido por IA (TRNSF-967) — recolhe dados da
           empresa e importa a elegibilidade do aviso (TRNSF-1034) ── */}
      <PreDiagnosticoPanel projectId={projectId} onConcluido={reload} />

      {/* ── Elegibilidade do aviso (admin) — depois do pré-diagnóstico, que a
           propõe automaticamente; aqui revê-se e valida-se ── */}
      {canManageUsers(user?.role ?? "CONSULTOR") && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div className="dp-section-title" style={{ marginBottom: 0 }}>Elegibilidade do aviso</div>
            <span className={"badge " + (data.eligibilidade?.estado === "validado" ? "badge-green" : data.eligibilidade ? "badge-warning" : "badge-muted")}>
              {data.eligibilidade?.estado === "validado" ? "Validada" : data.eligibilidade ? "Por validar" : "Não definida"}
            </span>
          </div>
          <AvisoElegibilidadeEditor
            projectId={projectId}
            atual={data.eligibilidade}
            fonteUrlAviso={data.grid?.fonteUrl ?? null}
            onSaved={reload}
          />
        </div>
      )}

      {/* ── Condições de acesso ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="dp-section-title" style={{ marginBottom: 0 }}>Condições de acesso</div>
          {nSugestoes > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={aplicarSugestoes} title="Preenche as condições com sugestão determinística; reveja e guarde">
              Aplicar sugestões ({nSugestoes})
            </button>
          )}
        </div>
        {nSugestoes > 0 && (
          <p className="deadline-sub" style={{ margin: "6px 0 4px" }}>
            Há {nSugestoes} condição(ões) com Provável PASSA/FALHA. "Aplicar sugestões" preenche-as — confirme e guarde; o estado final é seu.
          </p>
        )}
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
            <span className="cond-main">
              <span className="cond-label">{c.label}</span>
              {c.sugestao && (
                <span className="cond-sugestao">
                  <span className={"badge " + SUG_BADGE[c.sugestao].cls}>{SUG_BADGE[c.sugestao].label}</span>
                  {c.sugestaoNota && <span className="deadline-sub">{c.sugestaoNota}</span>}
                </span>
              )}
            </span>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="dp-section-title" style={{ marginBottom: 0 }}>Mérito</div>
          {data.grid && gridData && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={sugerirMerito}
              disabled={sugerindo || saving}
              title="A IA propõe uma pontuação por subcritério a partir dos dados do projeto; reveja, ajuste e guarde"
            >
              {sugerindo ? "A sugerir…" : "Sugerir pontuação (IA)"}
            </button>
          )}
        </div>

        {!data.grid && (
          <p style={{ fontSize: 12.5, color: "var(--warning)", marginTop: 8 }}>
            Grelha não configurada para este aviso. Não é possível calcular a pontuação de mérito.
          </p>
        )}

        {data.grid && gridData && (
          <>
            {meritProposal && Object.keys(meritProposal.selection).length > 0 && (
              <div className="card" style={{ margin: "10px 0", background: "var(--surface-2, #fafafa)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge badge-warning">Proposta da IA · por validar</span>
                  {meritProposal.nota && <span className="deadline-sub">{meritProposal.nota}</span>}
                </div>
                <p className="deadline-sub" style={{ margin: "6px 0 0" }}>
                  A IA propôs estas pontuações a partir dos dados do projeto — reveja, ajuste e guarde; a pontuação final é sua.
                </p>
              </div>
            )}
            {meritProposal && Object.keys(meritProposal.selection).length === 0 && meritProposal.nota && (
              <p className="deadline-sub" style={{ margin: "10px 0 0" }}>
                {meritProposal.nota}
              </p>
            )}
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
                <Dropdown
                  block
                  value={regiao}
                  onChange={setRegiao}
                  placeholder="— escolher região —"
                  options={data.availableRegions.map((r) => ({ value: r, label: r }))}
                />
                {!data.regiao && data.regiaoSugerida && regiao === data.regiaoSugerida && (
                  <p className="deadline-sub" style={{ marginTop: 4 }}>
                    Pré-preenchida a partir da localização validada da empresa —
                    confirme se o investimento é noutra região.
                  </p>
                )}
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
                          <Dropdown
                            block
                            value={selection[sub.codigo] != null ? String(selection[sub.codigo]) : ""}
                            onChange={(v) => setSelection((s) => ({ ...s, [sub.codigo]: Number(v) }))}
                            placeholder="— escolher —"
                            options={opts.map((o, i) => ({ value: String(i), label: `${o.label} (${o.pts})` }))}
                          />
                        )}
                        {meritProposal?.justificacoes[sub.codigo] && (
                          <p className="deadline-sub" style={{ margin: "4px 0 0" }}>
                            IA: {meritProposal.justificacoes[sub.codigo]}
                          </p>
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
          disabled={
            saving ||
            !data.avisoConfirmado ||
            (data.result !== "ELEGIVEL" && data.result !== "A_REVER")
          }
          title={
            !data.avisoConfirmado
              ? "Escolha e confirme o aviso do projeto para avançar"
              : data.result === "ELEGIVEL" || data.result === "A_REVER"
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
