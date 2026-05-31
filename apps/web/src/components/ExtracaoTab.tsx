import { useState } from "react";
import {
  EXTRACT_METHOD_LABELS,
  type ExtractaoDTO,
  type ExtractaoFieldDTO,
  type ProjectExtracoesDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/** Apresentação legível de um valor extraído (escalar, tabela ou objeto). */
function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-PT");
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `${v.length} linha(s)`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.linhas)) return `${(o.linhas as unknown[]).length} linha(s)`;
    return JSON.stringify(v);
  }
  return String(v);
}

function isScalar(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number";
}

const confLabel = (c: number | null): string =>
  c == null ? "leitura exata" : `${Math.round(c * 100)}% confiança`;

/**
 * Separador Extração (TRNSF-952): a fila de validação dos dados extraídos dos
 * documentos. Determinístico (leitura por código) ou IA, sempre validado por
 * humano antes de preencher a candidatura.
 */
export function ExtracaoTab({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<ProjectExtracoesDTO>(
    () => api.extracoes(projectId),
    [projectId],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar extrações…</p>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.candidaturaId === null) {
    return (
      <div style={{ maxWidth: 560 }}>
        <p className="cand-empty">
          Inicie a candidatura (separador <strong>Candidatura</strong>) para que os documentos
          arquivados possam pré-preencher os campos por extração.
        </p>
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.runExtracoes(projectId);
      setMsg(`Extração concluída: ${r.processados} documento(s) processado(s).`);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao correr a extração.");
    } finally {
      setBusy(false);
    }
  }

  const empty = data.queue.length === 0 && data.processed.length === 0;

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="section-header">
        <div className="section-title">Extração de dados</div>
        <button className="btn btn-secondary" disabled={busy} onClick={run}>
          Correr extração
        </button>
      </div>
      <p className="deadline-sub" style={{ marginBottom: 12 }}>
        Os dados lidos dos documentos arquivados entram aqui por validar. Determinístico
        primeiro (lido por código); IA só quando não há estrutura. Nada preenche a
        candidatura sem a sua confirmação.
      </p>
      {msg && <div className="login-error" style={{ marginBottom: 12 }}>{msg}</div>}

      {empty && (
        <p className="cand-empty">
          Sem extrações ainda. Arquive documentos com extractor (IES, mapas, certidão,
          RCBE, orçamentos) ou clique em <strong>Correr extração</strong>.
        </p>
      )}

      {/* Conflitos entre fontes (assinalados, nunca resolvidos em silêncio) */}
      {data.conflicts.length > 0 && (
        <div className="card cand-section" style={{ borderColor: "var(--danger, #c0392b)" }}>
          <div className="cand-section-head">
            <span className="cand-section-name">⚠️ Conflitos entre fontes</span>
            <span className="deadline-sub">{data.conflicts.length}</span>
          </div>
          {data.conflicts.map((c) => (
            <div className="cand-field" key={`${c.section}::${c.key}`}>
              <div className="cand-field-main">
                <span className="cand-field-key">{c.label}</span>
                <span className="badge badge-warning">{c.fontes.length} fontes</span>
              </div>
              <div className="cand-field-value" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                {c.fontes.map((f) => (
                  <span key={f.extracaoId} className="deadline-sub">
                    {f.documentName}: <strong>{formatValue(f.value)}</strong>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="deadline-sub" style={{ marginTop: 4 }}>
            Confirme em cada extração qual o valor a manter.
          </p>
        </div>
      )}

      {/* Fila de validação */}
      {data.queue.map((ex) => (
        <ExtracaoCard key={ex.id} ex={ex} onChanged={reload} />
      ))}

      {/* Processadas */}
      {data.processed.length > 0 && (
        <div className="card cand-section">
          <div className="cand-section-head">
            <span className="cand-section-name">Processadas</span>
            <span className="deadline-sub">{data.processed.length}</span>
          </div>
          {data.processed.map((ex) => (
            <div className="cand-field" key={ex.id}>
              <div className="cand-field-main">
                <span className="cand-field-key">{ex.tipoDocumentoLabel}</span>
                <span className="deadline-sub">{ex.documentName}</span>
              </div>
              <div className="cand-field-value">
                <span className="badge badge-muted">
                  {ex.estado === "corrigido" ? "✏️ corrigido" : "🟢 validado"}
                </span>
                <span className="deadline-sub">
                  {ex.campos.length} campo(s){ex.validatedBy ? ` · ${ex.validatedBy}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cartão de uma extração por validar: campos com aceitar/corrigir + confirmar. */
function ExtracaoCard({ ex, onChanged }: { ex: ExtractaoDTO; onChanged: () => void }) {
  // estado por campo: aceite (default) + valor corrigido (string) se editado
  const [state, setState] = useState<Record<string, { accept: boolean; edited: string | null }>>(
    () => Object.fromEntries(ex.campos.map((c) => [`${c.section}::${c.key}`, { accept: true, edited: null }])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const semCampos = ex.campos.length === 0;

  function update(k: string, patch: Partial<{ accept: boolean; edited: string | null }>) {
    setState((s) => ({ ...s, [k]: { ...s[k]!, ...patch } }));
  }

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const fields = ex.campos.map((c) => {
        const k = `${c.section}::${c.key}`;
        const st = state[k]!;
        const out: { section: string; key: string; accept: boolean; value?: unknown } = {
          section: c.section,
          key: c.key,
          accept: st.accept,
        };
        if (st.accept && st.edited !== null) out.value = parseEdited(st.edited, c.value);
        return out;
      });
      await api.validateExtracao(ex.id, { fields });
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao confirmar.");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    setErr(null);
    try {
      await api.rejectExtracao(ex.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao descartar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card cand-section">
      <div className="cand-section-head">
        <span className="cand-section-name">{ex.tipoDocumentoLabel}</span>
        <span className="deadline-sub">{ex.documentName}</span>
      </div>
      <div className="cand-summary" style={{ marginBottom: 8 }}>
        <span className="badge badge-muted">{EXTRACT_METHOD_LABELS[ex.metodo]}</span>
        <span className="deadline-sub">{confLabel(ex.confianca)}</span>
      </div>
      {ex.nota && <p className="cand-empty">{ex.nota}</p>}

      {semCampos ? (
        <p className="cand-empty">Sem campos extraídos — nada a preencher por aqui.</p>
      ) : (
        ex.campos.map((c) => {
          const k = `${c.section}::${c.key}`;
          const st = state[k]!;
          return (
            <ExtracaoFieldRow
              key={k}
              campo={c}
              accept={st.accept}
              edited={st.edited}
              onAccept={(v) => update(k, { accept: v })}
              onEdit={(v) => update(k, { edited: v })}
            />
          );
        })
      )}

      {err && <div className="login-error" style={{ marginTop: 8 }}>{err}</div>}
      <div className="cand-actions" style={{ marginTop: 10 }}>
        {!semCampos && (
          <button className="btn btn-primary" disabled={busy} onClick={confirm}>
            Confirmar e preencher candidatura
          </button>
        )}
        <button className="btn btn-secondary" disabled={busy} onClick={discard}>
          Descartar
        </button>
      </div>
    </div>
  );
}

function ExtracaoFieldRow({
  campo,
  accept,
  edited,
  onAccept,
  onEdit,
}: {
  campo: ExtractaoFieldDTO;
  accept: boolean;
  edited: string | null;
  onAccept: (v: boolean) => void;
  onEdit: (v: string | null) => void;
}) {
  const editable = isScalar(campo.value);
  return (
    <div className="cand-field">
      <div className="cand-field-main">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={accept} onChange={(e) => onAccept(e.target.checked)} />
          <span className="cand-field-key">{campo.label}</span>
        </label>
        <span className="cand-field-prov">
          {campo.conflito && <span className="badge badge-warning" style={{ marginRight: 6 }}>conflito</span>}
          {campo.confianca != null && (
            <span className="deadline-sub">{Math.round(campo.confianca * 100)}%</span>
          )}
        </span>
      </div>
      <div className="cand-field-value">
        {editable && edited !== null ? (
          <input
            className="login-input"
            value={edited}
            disabled={!accept}
            onChange={(e) => onEdit(e.target.value)}
          />
        ) : (
          <span>{formatValue(campo.value)}</span>
        )}
        {editable && (
          <span className="cand-field-buttons">
            {edited === null ? (
              <button className="back-link" disabled={!accept} onClick={() => onEdit(String(campo.value ?? ""))}>
                corrigir
              </button>
            ) : (
              <button className="back-link" onClick={() => onEdit(null)}>repor</button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/** Converte o texto corrigido de volta ao tipo do valor original. */
function parseEdited(text: string, original: unknown): unknown {
  if (typeof original === "number") {
    const n = Number(text.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : text;
  }
  return text;
}
