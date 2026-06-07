import { useState } from "react";
import {
  FAIXA_ESTADO_LABEL,
  FIELD_ORIGIN_LABELS,
  FIELD_STATE_BADGE,
  isFieldFinal,
  requiresHumanValidation,
  type FaixaEstado,
  type PreDiagCampo,
  type PreDiagnosticoDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

const faixaBadge = (e: FaixaEstado) =>
  e === "ok" ? "badge-green" : e === "falhou" ? "badge-danger" : "badge-muted";

/**
 * Pré-diagnóstico assistido por IA (TRNSF-967) no ecrã de Diagnóstico A0.
 * Rascunho com proveniência e fonte por campo; validável campo a campo.
 * Enquanto não validado, NÃO tem efeito (não altera estado nem elegibilidade).
 */
export function PreDiagnosticoPanel({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<PreDiagnosticoDTO>(() => api.prediagnostico(projectId), [projectId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading || error || !data) return null;

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro."); }
    finally { setBusy(false); }
  }

  const inexistente = data.estado === "inexistente";

  return (
    <div className="card" style={{ marginBottom: 16, maxWidth: 820 }}>
      <div className="section-header" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ fontSize: 15 }}>Pré-diagnóstico assistido por IA</div>
        <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.runPrediagnostico(projectId), "A correr em segundo plano… atualize daqui a pouco.")}>
          {inexistente ? "Correr pré-diagnóstico" : "Recorrer"}
        </button>
      </div>

      {inexistente ? (
        <p className="cand-empty" style={{ margin: 0 }}>
          Sem pré-diagnóstico. Corre automaticamente ao criar o cliente (com NIF); pode também correr aqui.
        </p>
      ) : (
        <>
          {/* Estado das faixas (fontes) */}
          <div className="cand-summary" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <span className={"badge " + faixaBadge(data.faixas.vies)}>VIES: {FAIXA_ESTADO_LABEL[data.faixas.vies]}</span>
            <span className={"badge " + faixaBadge(data.faixas.apiEmpresas)}>API empresas: {FAIXA_ESTADO_LABEL[data.faixas.apiEmpresas]}</span>
            <span className={"badge " + faixaBadge(data.faixas.sonar)}>Sonar: {FAIXA_ESTADO_LABEL[data.faixas.sonar]}</span>
            <span className={"badge " + faixaBadge(data.faixas.sonnet)}>Sonnet 4.6: {FAIXA_ESTADO_LABEL[data.faixas.sonnet]}</span>
            {data.executadoEm && <span className="deadline-sub">{new Date(data.executadoEm).toLocaleString("pt-PT")}</span>}
          </div>
          {/* Razão de falha por faixa (diagnóstico) */}
          {(data.faixasDetalhe?.apiEmpresas || data.faixasDetalhe?.vies) && (
            <p className="deadline-sub" style={{ marginTop: 0, marginBottom: 8 }}>
              {data.faixasDetalhe?.vies && <span>VIES: {data.faixasDetalhe.vies}. </span>}
              {data.faixasDetalhe?.apiEmpresas && <span>API empresas: {data.faixasDetalhe.apiEmpresas}.</span>}
            </p>
          )}
          {/* Faixas sem chave: nota de configuração (não é erro) */}
          {(data.faixas.sonar === "sem_chave" || data.faixas.sonnet === "sem_chave" || data.faixas.apiEmpresas === "sem_chave") && (
            <p className="deadline-sub" style={{ marginTop: 0, marginBottom: 8 }}>
              Faixas "Sem chave" estão desativadas por falta de credencial no ambiente (degradação graciosa) — não inventam dados.
            </p>
          )}
          <p className="deadline-sub" style={{ marginTop: 0 }}>
            Rascunho — a IA não decide elegibilidade. Valide campo a campo; nada tem efeito sem validação.
          </p>

          {/* Campos pré-preenchidos com proveniência */}
          {data.campos.map((c) => (
            <CampoRow key={c.key} projectId={projectId} campo={c} onChanged={reload} />
          ))}
          {data.campos.length === 0 && <p className="cand-empty">Sem campos pré-preenchidos.</p>}

          {/* Checklist "a confirmar oficialmente" */}
          {data.checklistAConfirmar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="cand-section-name" style={{ marginBottom: 6 }}>A confirmar oficialmente</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.checklistAConfirmar.map((c, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    {c.item}{c.nota ? <span className="deadline-sub"> — {c.nota}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fontes (auditoria) */}
          {data.fontesSonar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="cand-section-name" style={{ marginBottom: 6 }}>Fontes</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.fontesSonar.slice(0, 8).map((u, i) => (
                  <li key={i} style={{ fontSize: 12 }}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>
                ))}
              </ul>
            </div>
          )}

          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}

function CampoRow({ projectId, campo, onChanged }: { projectId: string; campo: PreDiagCampo; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(campo.value ?? ""));
  const [busy, setBusy] = useState(false);
  const badge = FIELD_STATE_BADGE[campo.estado];
  const final = isFieldFinal(campo.origem, campo.estado);

  async function act(action: "validar" | "corrigir") {
    setBusy(true);
    try {
      await api.updatePrediagCampo(projectId, { key: campo.key, action, value: action === "corrigir" ? val : undefined });
      setEditing(false);
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="cand-field">
      <div className="cand-field-main">
        <span className="cand-field-key">{campo.label}</span>
        <span className="cand-field-prov" title={campo.fonte ?? undefined}>
          {badge.icon} {FIELD_ORIGIN_LABELS[campo.origem]}
          {campo.fonte ? <span className="deadline-sub"> · {campo.fonte}</span> : null}
          {!final && requiresHumanValidation(campo.origem) && (
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
          <span>{String(campo.value ?? "—")}</span>
          <span className="cand-field-buttons">
            <button className="back-link" onClick={() => setEditing(true)}>corrigir</button>
            {requiresHumanValidation(campo.origem) && campo.estado === "por_validar" && (
              <button className="back-link" disabled={busy} onClick={() => act("validar")}>validar</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
