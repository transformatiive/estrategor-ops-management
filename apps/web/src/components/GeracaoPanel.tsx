import { useState } from "react";
import type { CandidaturaGeracaoDTO, GeneratedFieldDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/**
 * Painel de geração IA dos campos de texto (TRNSF-943), no separador Candidatura.
 * "Gerar minuta" por campo → preenche o núcleo com origem='gerado'. O consultor
 * refina; campos com [A PREENCHER: ...] ficam assinalados. Não gera às cegas.
 */
export function GeracaoPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<CandidaturaGeracaoDTO>(
    () => api.geracao(projectId),
    [projectId],
  );
  const [open, setOpen] = useState(false);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const porGerar = data.campos.filter((c) => c.estado === null).length;
  const porValidar = data.campos.filter((c) => c.estado === "por_validar").length;
  const comPlaceholders = data.campos.filter((c) => c.placeholders > 0).length;

  function afterChange() {
    reload();
    onChanged();
  }

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Minutas de texto (geração IA)</span>
        <span className="deadline-sub">
          {porGerar} por gerar · {porValidar} por validar
          {comPlaceholders > 0 ? ` · ${comPlaceholders} c/ [A PREENCHER]` : ""}
        </span>
      </div>

      {data.configMissing && (
        <div className="login-error" style={{ marginTop: 8 }}>
          Configuração em falta — não gerar às cegas: {data.configMissing}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 10 }}>
          {data.campos.map((c) => (
            <GeracaoFieldRow
              key={c.docType}
              projectId={projectId}
              field={c}
              blocked={!!data.configMissing}
              onChanged={afterChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GeracaoFieldRow({
  projectId,
  field,
  blocked,
  onChanged,
}: {
  projectId: string;
  field: GeneratedFieldDTO;
  blocked: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(field.conteudo ?? "");

  async function gerar() {
    setBusy(true);
    setErr(null);
    try {
      await api.gerarMinuta(projectId, field.docType);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  }

  async function guardar() {
    setBusy(true);
    setErr(null);
    try {
      await api.updateCandField(projectId, {
        section: field.section,
        key: field.key,
        action: "corrigir",
        value: text,
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }

  const stateBadge =
    field.estado === null ? (
      <span className="badge badge-muted">por gerar</span>
    ) : field.estado === "por_validar" ? (
      <span className="badge badge-warning">gerado · por validar</span>
    ) : field.estado === "corrigido" ? (
      <span className="badge badge-muted">✏️ corrigido</span>
    ) : (
      <span className="badge badge-muted">🟢 validado</span>
    );

  return (
    <div className="cand-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
      <div className="cand-field-main">
        <span className="cand-field-key">
          {field.label}
          {field.condicional ? " (condicional)" : ""}
        </span>
        <span className="cand-field-prov">
          {stateBadge}
          <span className="deadline-sub" style={{ marginLeft: 6 }}>
            {field.charCount}/{field.charLimit}
            {field.excedeLimite ? " ⚠️ excede" : ""}
            {field.placeholders > 0 ? ` · ${field.placeholders} [A PREENCHER]` : ""}
            {` · ${field.model}`}
          </span>
        </span>
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            className="login-input"
            style={{ minHeight: 140, fontFamily: "inherit" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={field.charLimit + 500}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={busy} onClick={guardar}>Guardar (corrigido)</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => { setEditing(false); setText(field.conteudo ?? ""); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="cand-field-value" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          {field.conteudo && (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", color: field.estado === "por_validar" ? "var(--accent, #2563eb)" : undefined }}>
              {field.conteudo.length > 400 ? field.conteudo.slice(0, 400) + "…" : field.conteudo}
            </pre>
          )}
          <span className="cand-field-buttons">
            <button className="btn btn-secondary" disabled={busy || blocked} onClick={gerar}>
              {field.estado === null ? "Gerar minuta" : "Regerar"}
            </button>
            {field.conteudo && (
              <button className="back-link" onClick={() => setEditing(true)}>refinar</button>
            )}
          </span>
        </div>
      )}
      {err && <div className="login-error">{err}</div>}
    </div>
  );
}
