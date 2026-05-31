import { useState } from "react";
import { DEADLINE_SEVERITY_LABEL, type DeadlineDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

const SEV_BADGE: Record<DeadlineDTO["severity"], string> = {
  atrasado: "badge-danger",
  urgente: "badge-warning",
  proximo: "badge-muted",
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-PT");

/** Prazos do projeto: adicionar, concluir, remover. Alimenta a vista Prazos. */
export function ProjectDeadlines({ projectId }: { projectId: string }) {
  const { data, loading, error, reload } = useAsync<DeadlineDTO[]>(() => api.deadlines(projectId), [projectId]);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [portal, setPortal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading || error || !data) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { await fn(); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro."); }
    finally { setBusy(false); }
  }

  const pendentes = data.filter((d) => d.status !== "completado");

  return (
    <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
      <div className="section-header" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ fontSize: 15 }}>Prazos do projeto</div>
      </div>

      {pendentes.length === 0 && data.length === 0 && (
        <p className="cand-empty" style={{ margin: "0 0 8px" }}>Sem prazos. Adicione abaixo (ex.: data de submissão do aviso).</p>
      )}

      {data.map((d) => (
        <div className="cand-field" key={d.id}>
          <div className="cand-field-main">
            <span className="cand-field-key" style={{ textDecoration: d.status === "completado" ? "line-through" : undefined }}>
              {d.label}{d.portal ? ` · ${d.portal}` : ""}
            </span>
            <span className="cand-field-prov">
              {d.status === "completado"
                ? <span className="badge badge-muted">concluído</span>
                : <span className={"badge " + SEV_BADGE[d.severity]}>{DEADLINE_SEVERITY_LABEL[d.severity]}</span>}
              <span className="deadline-sub" style={{ marginLeft: 6 }}>{fmtDate(d.dueDate)}</span>
            </span>
          </div>
          <div className="cand-field-value">
            <span />
            <span className="cand-field-buttons">
              {d.status !== "completado" && (
                <button className="back-link" disabled={busy} onClick={() => run(() => api.updateDeadline(d.id, { status: "completado" }))}>concluir</button>
              )}
              <button className="back-link" disabled={busy} onClick={() => run(() => api.deleteDeadline(d.id))}>remover</button>
            </span>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <input className="login-input" style={{ flex: "2 1 160px" }} placeholder="Obrigação (ex.: Submissão da candidatura)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="login-input" style={{ flex: "1 1 130px" }} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <input className="login-input" style={{ flex: "1 1 100px" }} placeholder="Portal (opc.)" value={portal} onChange={(e) => setPortal(e.target.value)} />
        <button
          className="btn btn-primary"
          disabled={busy || !label || !dueDate}
          onClick={() => run(async () => { await api.addDeadline(projectId, { label, dueDate, portal: portal || null }); setLabel(""); setDueDate(""); setPortal(""); })}
        >
          Adicionar prazo
        </button>
      </div>
      {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
