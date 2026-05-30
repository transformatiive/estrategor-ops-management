import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { PublicCollectionDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

/**
 * Formulário público do cliente (sem login) — acedido pela ligação de recolha.
 * Mostra o que falta entregar e permite upload (incl. foto do telemóvel via
 * capture). Cada ficheiro vai para a subpasta WorkDrive correcta (TRNSF-937).
 */
export function RecolhaPublica() {
  const { token = "" } = useParams();
  const { data, loading, error, reload } = useAsync(
    () => api.publicCollection(token),
    [token],
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);

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
          <div className="recolha-list">
            {data.items.map((item) => (
              <DocRow
                key={item.documentTypeKey}
                item={item}
                disabled={uploading !== null}
                uploading={uploading === item.documentTypeKey}
                message={msg?.key === item.documentTypeKey ? msg : null}
                onUpload={async (file) => {
                  setMsg(null);
                  setUploading(item.documentTypeKey);
                  try {
                    await api.uploadDocument(token, item.documentTypeKey, file);
                    setMsg({ key: item.documentTypeKey, text: "Entregue ✓", ok: true });
                    reload();
                  } catch (e) {
                    setMsg({
                      key: item.documentTypeKey,
                      text: e instanceof ApiError ? e.message : "Falha no envio.",
                      ok: false,
                    });
                  } finally {
                    setUploading(null);
                  }
                }}
              />
            ))}
          </div>
        )}

        <p className="recolha-foot">
          Os seus documentos são enviados de forma segura para a Estrategor.
        </p>
      </div>
    </div>
  );
}

function DocRow({
  item,
  onUpload,
  uploading,
  disabled,
  message,
}: {
  item: PublicCollectionDTO["items"][number];
  onUpload: (file: File) => void;
  uploading: boolean;
  disabled: boolean;
  message: { text: string; ok: boolean } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="recolha-item">
      <div className="recolha-item-main">
        <span className="recolha-item-name">{item.documentTypeName}</span>
        {item.delivered ? (
          <span className="badge badge-green">Entregue</span>
        ) : (
          <span className="badge badge-danger">Em falta</span>
        )}
      </div>
      {!item.delivered && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn btn-secondary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "A enviar…" : "Carregar / tirar foto"}
          </button>
        </>
      )}
      {message && (
        <span style={{ fontSize: 11.5, color: message.ok ? "var(--accent)" : "var(--danger)" }}>
          {message.text}
        </span>
      )}
    </div>
  );
}
