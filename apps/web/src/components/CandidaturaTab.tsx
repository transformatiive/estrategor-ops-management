import { useState } from "react";
import {
  CAND_FAMILIES_V0,
  CAND_FAMILY_LABELS,
  CAND_STAGE_LABELS,
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
import { ExportPanel } from "./ExportPanel.js";
import { TipologiasPanel } from "./TipologiasPanel.js";
import { AtividadesPanel } from "./AtividadesPanel.js";
import { InovacaoExtraPanel } from "./InovacaoExtraPanel.js";
import { InovacaoCondPanel } from "./InovacaoCondPanel.js";
import { IntlAcoesPanel } from "./IntlAcoesPanel.js";
import { IntlDetalhePanel } from "./IntlDetalhePanel.js";
import { RevisaoInternaPanel } from "./RevisaoInternaPanel.js";

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
        <span className="badge badge-muted">{CAND_STAGE_LABELS[cand.stage]}</span>
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
              Submeter para revisão interna
            </button>
          )}
          {cand.stage === "A3" && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => stage("A2")}>
              Devolver para preparação
            </button>
          )}
        </div>
        {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Revisão interna A3 (TRNSF-947) — painel de aprovação/devolução + histórico */}
      <RevisaoInternaPanel projectId={projectId} stage={cand.stage} onChanged={reload} />

      {/* Secções específicas da Família A — Inovação Produtiva */}
      {cand.family === "inovacao_produtiva" && (
        <>
          <TipologiasPanel projectId={projectId} onChanged={reload} />
          <AtividadesPanel projectId={projectId} onChanged={reload} />
          <InovacaoExtraPanel projectId={projectId} onChanged={reload} />
          <InovacaoCondPanel projectId={projectId} onChanged={reload} />
        </>
      )}

      {/* Secções específicas da Família B — Internacionalização */}
      {cand.family === "internacionalizacao" && (
        <>
          <IntlAcoesPanel projectId={projectId} onChanged={reload} />
          <IntlDetalhePanel projectId={projectId} onChanged={reload} />
        </>
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
            {sec.key === "beneficiario" && (
              <BeneficiarioImportButton projectId={projectId} onImported={reload} />
            )}
          </div>
          {sec.total === 0 && (
            <p className="cand-empty">
              Por preencher — adicione campos manualmente ou aguarde a extração / intake / geração dos passos seguintes.
            </p>
          )}
          {sec.fields.map((f) => (
            <FieldRow key={f.id} projectId={projectId} field={f} onChanged={reload} />
          ))}
          <AddFieldForm projectId={projectId} section={sec.key} onAdded={reload} />
        </div>
      ))}

      {/* Exportação estruturada (TRNSF-954) — último passo: depois do conteúdo */}
      <ExportPanel projectId={projectId} />
    </div>
  );
}

/** Resumo legível de um valor: pares "rótulo: valor", sem id e sem JSON cru. */
function entryToText(entry: unknown): string {
  if (entry === null || entry === undefined) return "—";
  if (typeof entry !== "object") return String(entry);
  const obj = entry as Record<string, unknown>;
  const parts = Object.entries(obj)
    .filter(([k, v]) => k !== "id" && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(" · ") : "—";
}

/** Render legível do valor de um campo (evita JSON cru no preview — TRNSF-1054). */
function FieldValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span>—</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>—</span>;
    return (
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {value.map((entry, i) => (
          <li key={i}>{entryToText(entry)}</li>
        ))}
      </ul>
    );
  }
  return <span>{entryToText(value)}</span>;
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

  // Campo manual: criado pelo consultor (origin "intake", sourceRef "manual").
  // Só estes são removíveis; campos automáticos não devem poder ser apagados.
  const manual = field.origin === "intake";

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

  async function remove() {
    setBusy(true);
    try {
      await api.deleteCandField(projectId, field.id);
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
          <FieldValue value={field.value} />
          <span className="cand-field-buttons">
            <button className="back-link" onClick={() => setEditing(true)}>corrigir</button>
            {requiresHumanValidation(field.origin) && field.state === "por_validar" && (
              <button className="back-link" disabled={busy} onClick={() => act("validar")}>validar</button>
            )}
            {manual && (
              <button className="back-link" disabled={busy} title="Remover campo" onClick={remove}>✕</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Editor de intake manual (TRNSF-1062): permite ao consultor acrescentar um
 * campo livre (rótulo + valor) a uma secção genérica. O rótulo torna-se a chave
 * do campo (não há coluna `label`); entra como `intake`/`validado`.
 */
function AddFieldForm({
  projectId,
  section,
  onAdded,
}: {
  projectId: string;
  section: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    setOpen(false);
    setLabel("");
    setValue("");
    setErro(null);
  }

  async function guardar() {
    setBusy(true);
    setErro(null);
    try {
      await api.addManualField(projectId, { section, label, value });
      cancelar();
      onAdded();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível adicionar o campo.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="back-link" onClick={() => setOpen(true)}>
        + Adicionar campo
      </button>
    );
  }

  return (
    <div className="cand-field-edit" style={{ marginTop: 8 }}>
      <input
        className="login-input"
        placeholder="Rótulo"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        className="login-input"
        placeholder="Valor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="btn btn-primary" disabled={busy} onClick={guardar}>Guardar</button>
      <button className="btn btn-secondary" disabled={busy} onClick={cancelar}>Cancelar</button>
      {erro && <span className="login-error" style={{ flexBasis: "100%" }}>{erro}</span>}
    </div>
  );
}

/**
 * Botão de importação da identificação do beneficiário a partir do NIF da
 * empresa (TRNSF-1061). Chama os adaptadores nif.pt + VIES (via API) e recarrega
 * a secção; os campos entram como `por_validar` para o consultor validar.
 */
function BeneficiarioImportButton({
  projectId,
  onImported,
}: {
  projectId: string;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function importar() {
    setBusy(true);
    setMsg(null);
    setErro(null);
    try {
      const res = await api.importBeneficiario(projectId);
      setMsg(res.mensagem);
      onImported();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
      {msg && <span className="deadline-sub">{msg}</span>}
      {erro && <span className="login-error">{erro}</span>}
      <button className="btn btn-secondary" disabled={busy} onClick={importar}>
        {busy ? "A importar…" : "Importar dados da empresa (NIF)"}
      </button>
    </span>
  );
}
