import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { IntakeInovacao } from "../components/IntakeInovacao.js";
import { IntakeIntl } from "../components/IntakeIntl.js";

interface UploadState {
  name: string;
  status: "a_enviar" | "enviado" | "erro";
  error?: string;
}

/**
 * Formulário público do cliente (sem login) — acedido pela ligação de recolha.
 * O cliente larga todos os ficheiros num único campo; a IA identifica e arquiva
 * cada documento (TRNSF-937/938). Não é preciso indicar o tipo. A lista do que
 * foi pedido aparece apenas como referência.
 */
export function RecolhaPublica() {
  const { token = "" } = useParams();
  const { data, loading, error, reload } = useAsync(
    () => api.publicCollection(token),
    [token],
  );
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const list = Array.from(files);
    setUploads((prev) => [
      ...prev,
      ...list.map((f) => ({ name: f.name, status: "a_enviar" as const })),
    ]);
    for (const file of list) {
      try {
        await api.uploadDocument(token, file); // sem tipo → a IA classifica
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "a_enviar"
              ? { ...u, status: "enviado" }
              : u,
          ),
        );
      } catch (e) {
        const error = e instanceof ApiError ? e.message : "Falha no envio.";
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.status === "a_enviar"
              ? { ...u, status: "erro", error }
              : u,
          ),
        );
      }
    }
    setBusy(false);
    reload();
  }

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">A carregar…</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">Estrategor</div>
          <p className="login-sub">Esta ligação é inválida ou já não está disponível.</p>
          <button className="btn btn-secondary" onClick={reload}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const expired = data.status === "EXPIRADO";
  const done = data.status === "USADO" || data.items.every((i) => i.delivered);

  return (
    <div className="recolha-screen">
      <div className="recolha-card">
        <div className="login-logo">
          Estrategor <span>/ Recolha</span>
        </div>
        <h2 className="recolha-title">{data.projectTitle}</h2>
        <p className="login-sub">
          {data.clientName} · {data.programCode}
        </p>

        {expired && (
          <div className="login-error">
            Esta ligação expirou. Contacte o seu consultor para receber uma nova.
          </div>
        )}

        {!expired && done && (
          <div className="recolha-done">✓ Todos os documentos foram entregues. Obrigado!</div>
        )}

        {!expired && (
          <>
            {/* Campo único de upload */}
            <div
              className="recolha-drop"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="recolha-drop-title">
                {busy ? "A enviar…" : "Carregar documentos / tirar foto"}
              </div>
              <div className="recolha-drop-sub">
                Arraste os ficheiros para aqui ou clique para escolher. Pode enviar
                vários de uma vez (PDF ou fotografia). Nós tratamos de identificar cada documento.
              </div>
            </div>

            {/* Ficheiros enviados nesta sessão */}
            {uploads.length > 0 && (
              <div className="recolha-uploads">
                {uploads.map((u, i) => (
                  <div className="recolha-upload-row" key={i}>
                    <span className="recolha-upload-name">{u.name}</span>
                    {u.status === "a_enviar" && <span className="deadline-sub">a enviar…</span>}
                    {u.status === "enviado" && <span className="badge badge-green">Recebido ✓</span>}
                    {u.status === "erro" && (
                      <span className="badge badge-danger" title={u.error}>Erro</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Lista de referência: documentos pedidos */}
            <div className="recolha-ref">
              <div className="recolha-ref-title">Documentos pedidos</div>
              {data.items.map((item) => (
                <div className="recolha-ref-row" key={item.documentTypeKey}>
                  <span>{item.documentTypeName}</span>
                  {item.delivered ? (
                    <span className="badge badge-green">Entregue</span>
                  ) : (
                    <span className="badge badge-muted">Em falta</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Ramos de intake por família — aparecem conforme a candidatura */}
        {!expired && <IntakeInovacao token={token} />}
        {!expired && <IntakeIntl token={token} />}

        <p className="recolha-foot">
          Os seus documentos são enviados de forma segura para a Estrategor.
        </p>
      </div>
    </div>
  );
}
