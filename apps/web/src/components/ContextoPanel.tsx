import { useState } from "react";
import {
  CAND_CONTEXT_KINDS,
  CAND_CONTEXT_KIND_LABELS,
  type CandContextKind,
  type CandContextSourceDTO,
  type ProjectDocumentsDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";

/**
 * Vista "Contexto" da Preparação (TRNSF-1068 · item 1). O consultor junta
 * fontes descritivas — texto colado (emails, descrição), candidaturas
 * anteriores, memória, mapas (como documento) — que passam a alimentar a
 * geração da candidatura. Inverte o processo: primeiro dar matéria-prima, depois
 * gerar.
 */
export function ContextoPanel({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<{ sources: CandContextSourceDTO[] }>(
    () => api.contexto(projectId),
    [projectId],
  );
  const { data: docs } = useAsync<ProjectDocumentsDTO>(() => api.documents(projectId), [projectId]);

  const [kind, setKind] = useState<CandContextKind>("texto");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const sources = data?.sources ?? [];
  const allDocs = [...(docs?.archived ?? []), ...(docs?.queue ?? [])];

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      await api.addContexto(projectId, {
        kind,
        label: label.trim() || undefined,
        content: kind === "documento" ? undefined : content,
        documentId: kind === "documento" ? documentId || undefined : undefined,
      });
      setLabel("");
      setContent("");
      setDocumentId("");
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível adicionar a fonte.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.removeContexto(projectId, id);
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível remover a fonte.");
    }
  }

  const podeAdd = kind === "documento" ? !!documentId : content.trim().length > 0;

  return (
    <div className="cand-summary">
      <p className="deadline-sub" style={{ marginBottom: 12 }}>
        Junte aqui o que descreve o projeto — texto de emails, descrição, candidaturas anteriores, memória
        descritiva ou mapas (como documento). Estas fontes alimentam a geração dos textos da candidatura.
      </p>

      {/* Formulário de nova fonte */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="cand-section-name" style={{ marginBottom: 8 }}>Nova fonte de contexto</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select className="login-input" value={kind} onChange={(e) => setKind(e.target.value as CandContextKind)}>
            {CAND_CONTEXT_KINDS.map((k) => (
              <option key={k} value={k}>{CAND_CONTEXT_KIND_LABELS[k]}</option>
            ))}
          </select>
          <input
            className="login-input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Rótulo (opcional) — ex.: Email do cliente, Memória 2024"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {kind === "documento" ? (
          <select className="login-input" style={{ width: "100%" }} value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
            <option value="">— Escolher documento do projeto —</option>
            {allDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.originalFilename}{d.documentTypeName ? ` · ${d.documentTypeName}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            className="login-input"
            style={{ width: "100%", minHeight: 120, resize: "vertical" }}
            placeholder="Cole aqui o texto (email, descrição do projeto, notas)…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}

        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-primary" disabled={busy || !podeAdd} onClick={add}>
            Adicionar fonte
          </button>
          {kind === "documento" && (
            <span className="deadline-sub">O texto do documento (PDF/Excel) é extraído automaticamente.</span>
          )}
        </div>
        {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      {/* Lista de fontes */}
      {sources.length === 0 ? (
        <p className="cand-empty">Ainda não há fontes de contexto. Adicione a primeira acima.</p>
      ) : (
        <div className="">
          {sources.map((s) => (
            <div className="card" key={s.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="badge badge-muted">{CAND_CONTEXT_KIND_LABELS[s.kind]}</span>
                  <strong>{s.label}</strong>
                  <span className="deadline-sub">{s.chars.toLocaleString("pt-PT")} caracteres</span>
                </div>
                <button className="btn btn-secondary" onClick={() => remove(s.id)}>Remover</button>
              </div>
              {s.preview && (
                <p className="deadline-sub" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {s.preview}{s.chars > s.preview.length ? "…" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
