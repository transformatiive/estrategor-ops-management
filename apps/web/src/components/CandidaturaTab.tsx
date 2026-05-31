import { useState } from "react";
import {
  CAND_FAMILIES_V0,
  CAND_FAMILY_LABELS,
  FIELD_ORIGIN_LABELS,
  FIELD_STATE_BADGE,
  isFieldFinal,
  requiresHumanValidation,
  type CandFamily,
  type CandidaturaDTO,
  type CandFieldDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";
import { GeracaoPanel } from "./GeracaoPanel.js";
import { FinanceiroPanel } from "./FinanceiroPanel.js";
import { CustosPanel } from "./CustosPanel.js";
import { VerificadorPanel } from "./VerificadorPanel.js";
import { TipologiasPanel } from "./TipologiasPanel.js";

type CandResponse = CandidaturaDTO | { candidatura: null; familyChosen: CandFamily | null };

function isStarted(d: CandResponse | null): d is CandidaturaDTO {
  return !!d && "sections" in d;
}

/** Separador Candidatura (TRNSF-942): preview pré-preenchido com proveniência. */
export function CandidaturaTab({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<CandResponse>(
    () => api.candidatura(projectId),
    [projectId],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar candidatura…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  // ── Por iniciar: escolher família ──
  if (!isStarted(data)) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="page-subtitle" style={{ marginBottom: 16 }}>
          A candidatura ainda não foi iniciada. Escolha a família do sistema de incentivos para começar.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CAND_FAMILIES_V0.map((f) => (
            <button
              key={f}
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  await api.startCandidatura(projectId, f);
                  reload();
                } catch (e) {
                  setMsg(e instanceof ApiError ? e.message : "Erro ao iniciar.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {CAND_FAMILY_LABELS[f]}
            </button>
          ))}
        </div>
        {msg && <div className="login-error" style={{ marginTop: 12 }}>{msg}</div>}
      </div>
    );
  }

  const cand = data;

  async function stage(to: "A3" | "A2") {
    setBusy(true);
    setMsg(null);
    try {
      await api.candidaturaStage(projectId, to);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro na transição.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="section-header">
        <div className="section-title">
          Candidatura — {cand.familyLabel}
          {cand.codigoAviso ? ` · ${cand.codigoAviso}` : ""}
        </div>
        <span className="badge badge-muted">Fase {cand.stage}</span>
      </div>

      {/* Resumo de proveniência */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cand-summary">
          <span>{cand.summary.finalised}/{cand.summary.total} campos finalizados</span>
          {cand.summary.pendingValidation > 0 && (
            <span className="badge badge-warning">
              {cand.summary.pendingValidation} por validar
            </span>
          )}
        </div>
        <div className="cand-actions">
          {cand.stage === "A2" && (
            <button className="btn btn-primary" disabled={busy} onClick={() => stage("A3")}>
              Submeter para revisão (A3)
            </button>
          )}
          {cand.stage === "A3" && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => stage("A2")}>
              Devolver para preparação (A2)
            </button>
          )}
        </div>
        {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Secções específicas da Família A — Inovação Produtiva */}
      {cand.family === "inovacao_produtiva" && (
        <TipologiasPanel projectId={projectId} onChanged={reload} />
      )}

      {/* Componente financeira (TRNSF-944) */}
      <FinanceiroPanel projectId={projectId} onChanged={reload} />

      {/* Custos / Investimentos + Resumo Executivo (TRNSF-945) */}
      <CustosPanel projectId={projectId} onChanged={reload} />

      {/* Verificador + Mérito (TRNSF-946) */}
      <VerificadorPanel projectId={projectId} />

      {/* Geração IA dos campos de texto (TRNSF-943) */}
      <GeracaoPanel projectId={projectId} onChanged={reload} />

      {/* Secções */}
      {cand.sections.map((sec) => (
        <div className="card cand-section" key={sec.key}>
          <div className="cand-section-head">
            <span className="cand-section-name">
              {sec.sgoRef ? `${sec.sgoRef}. ` : ""}{sec.name}
            </span>
            <span className="deadline-sub">
              {sec.total === 0 ? "sem dados ainda" : `${sec.finalised}/${sec.total}`}
            </span>
          </div>
          {sec.total === 0 ? (
            <p className="cand-empty">
              Por preencher — será montado pela extração / intake / geração nos passos seguintes.
            </p>
          ) : (
            sec.fields.map((f) => (
              <FieldRow key={f.id} projectId={projectId} field={f} onChanged={reload} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

/** Linha de campo do preview com indicador de proveniência + ações. */
function FieldRow({
  projectId,
  field,
  onChanged,
}: {
  projectId: string;
  field: CandFieldDTO;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(typeof field.value === "string" ? field.value : JSON.stringify(field.value ?? ""));
  const [busy, setBusy] = useState(false);
  const badge = FIELD_STATE_BADGE[field.state];
  const final = isFieldFinal(field.origin, field.state);

  async function act(action: "validar" | "corrigir") {
    setBusy(true);
    try {
      await api.updateCandField(projectId, {
        section: field.section,
        key: field.key,
        action,
        value: action === "corrigir" ? val : undefined,
      });
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cand-field">
      <div className="cand-field-main">
        <span className="cand-field-key">{field.key}</span>
        <span className="cand-field-prov" title={FIELD_ORIGIN_LABELS[field.origin]}>
          {badge.icon} {FIELD_ORIGIN_LABELS[field.origin]}
          {!final && requiresHumanValidation(field.origin) && (
            <span className="badge badge-warning" style={{ marginLeft: 6 }}>por validar</span>
          )}
        </span>
      </div>
      {editing ? (
        <div className="cand-field-edit">
          <input className="login-input" value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={() => act("corrigir")}>Guardar</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="cand-field-value">
          <span>{typeof field.value === "string" ? field.value : JSON.stringify(field.value ?? "—")}</span>
          <span className="cand-field-buttons">
            <button className="back-link" onClick={() => setEditing(true)}>corrigir</button>
            {requiresHumanValidation(field.origin) && field.state === "por_validar" && (
              <button className="back-link" disabled={busy} onClick={() => act("validar")}>validar</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
