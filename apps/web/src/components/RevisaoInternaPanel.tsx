import { useState } from "react";
import type { RevisaoChecklistItemDTO, RevisaoInternaDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { useAuth } from "../lib/auth.js";

/** Estilo (ponto + badge) por estado de um item da checklist de revisão. */
function itemStyle(status: RevisaoChecklistItemDTO["status"]): { dotCls: string; badgeCls: string; label: string } {
  if (status === "ok") return { dotCls: "tk-green", badgeCls: "badge-green", label: "OK" };
  if (status === "falha") return { dotCls: "tk-red", badgeCls: "badge-danger", label: "Em falta" };
  return { dotCls: "tk-amber", badgeCls: "badge-muted", label: "Indeterminado" };
}

/**
 * Painel de revisão interna (A3 — TRNSF-947). Um gestor revê a candidatura com
 * a checklist de aprovação e ou APROVA (→ A4) ou DEVOLVE ao consultor (→ A2)
 * com comentários. O histórico de decisões é mostrado em qualquer estado.
 */
export function RevisaoInternaPanel({
  projectId,
  stage,
  onChanged,
}: {
  projectId: string;
  stage: "A2" | "A3" | "A4";
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const { data, loading, error, reload } = useAsync<RevisaoInternaDTO>(
    () => api.revisao(projectId),
    [projectId, stage],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [modo, setModo] = useState<"none" | "aprovar" | "devolver">("none");
  const [comentarios, setComentarios] = useState("");

  if (loading) return null;
  if (error) {
    return (
      <div className="card cand-section">
        <div className="section-title">Revisão interna</div>
        <p className="login-error">Não foi possível carregar a revisão.</p>
        <button className="back-link" onClick={reload}>Tentar de novo</button>
      </div>
    );
  }
  if (!data) return null;

  const podeAprovarUi = data.podeAprovar && can("aprovar_revisao_interna");

  async function aprovar() {
    setBusy(true);
    setMsg(null);
    try {
      await api.aprovarRevisao(projectId, comentarios.trim() || undefined);
      setModo("none");
      setComentarios("");
      onChanged();
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function devolver() {
    if (!comentarios.trim()) {
      setMsg("Indique um comentário para devolver.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.devolverRevisao(projectId, comentarios.trim());
      setModo("none");
      setComentarios("");
      onChanged();
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao devolver.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card cand-section">
      <div className="cand-section-head">
        <span className="section-title">Revisão interna</span>
        {data.bloqueios > 0 && (
          <span className="badge badge-danger">{data.bloqueios} bloqueio(s)</span>
        )}
      </div>

      {/* Checklist de aprovação — só relevante em A3 */}
      {stage === "A3" && (
        <div style={{ marginBottom: 12 }}>
          {data.checklist.map((it) => {
            const s = itemStyle(it.status);
            return (
              <div key={it.key} className="cand-field">
                <div className="cand-field-main">
                  <span className="cand-field-key">
                    <span className={"tk-dot " + s.dotCls} /> {it.label}
                  </span>
                  <span className={"badge " + s.badgeCls}>{s.label}</span>
                </div>
                <div className="cand-field-value">
                  <span className="deadline-sub">{it.detalhe}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ações para quem pode aprovar */}
      {stage === "A3" && podeAprovarUi && (
        <div className="cand-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          {data.bloqueios > 0 && modo !== "devolver" && (
            <div className="badge badge-warning" style={{ alignSelf: "flex-start" }}>
              Há {data.bloqueios} item(s) por cumprir — pode aprovar mesmo assim.
            </div>
          )}

          {modo === "none" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={busy} onClick={() => { setModo("aprovar"); setMsg(null); }}>
                Aprovar e avançar para submissão
              </button>
              <button className="btn btn-secondary" disabled={busy} onClick={() => { setModo("devolver"); setMsg(null); }}>
                Devolver com comentários
              </button>
            </div>
          )}

          {modo === "aprovar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                className="login-input"
                rows={3}
                placeholder="Comentários (opcional)"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" disabled={busy} onClick={aprovar}>Confirmar aprovação</button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => { setModo("none"); setComentarios(""); }}>Cancelar</button>
              </div>
            </div>
          )}

          {modo === "devolver" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                className="login-input"
                rows={3}
                placeholder="Comentários para o consultor (obrigatório)"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" disabled={busy} onClick={devolver}>Confirmar devolução</button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => { setModo("none"); setComentarios(""); }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sem permissão para aprovar */}
      {stage === "A3" && !podeAprovarUi && (
        <p className="deadline-sub">Sem permissão para aprovar — contacte um gestor.</p>
      )}

      {msg && <div className="login-error" style={{ marginTop: 10 }}>{msg}</div>}

      {/* Histórico de decisões (sempre visível se existir) */}
      {data.historico.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="deadline-sub" style={{ marginBottom: 6 }}>Histórico de revisões</div>
          {data.historico.map((h) => (
            <div key={h.id} className="cand-field">
              <div className="cand-field-main">
                <span className="cand-field-key">
                  <span className={"badge " + (h.resultado === "aprovada" ? "badge-green" : "badge-danger")}>
                    {h.resultado === "aprovada" ? "Aprovada" : "Devolvida"}
                  </span>{" "}
                  {h.revisorNome}
                </span>
                <span className="deadline-sub">{new Date(h.createdAt).toLocaleString("pt-PT")}</span>
              </div>
              {h.comentarios && (
                <div className="cand-field-value">
                  <span className="deadline-sub">{h.comentarios}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
