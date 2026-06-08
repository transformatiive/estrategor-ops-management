import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LEAD_ESTADO_LABEL,
  PROGRAM_CODES,
  type LeadEstado,
  type LeadListItemDTO,
  type ProgramCode,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState, ProgramBadge } from "../components/ui.js";
import { Dropdown } from "../components/Dropdown.js";
import { PreDiagnosticoPanel } from "../components/PreDiagnosticoPanel.js";
import { DiagnosticoTab } from "../components/DiagnosticoTab.js";

const ESTADO_BADGE: Record<LeadEstado, string> = {
  analise: "badge-warning",
  qualificada: "badge-green",
  rejeitada: "badge-danger",
};

const COLS = "2fr 1.2fr 1fr 1.2fr 1fr";

/**
 * Análise (pré-projeto): lista de leads, criação de uma nova lead e detalhe com
 * o pré-diagnóstico. "Qualificar → criar projeto" materializa um Project na fase
 * de Recolha (A1). O diagnóstico de mérito por projeto mantém-se inalterado.
 */
export function Analise() {
  const { data: leads, loading, error, reload } = useAsync(() => api.leads());
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const all = leads ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Análise</div>
          <div className="page-subtitle">Qualificação de leads (pré-projeto) com pré-diagnóstico</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo lead
        </button>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {leads && all.length === 0 && (
        <div className="empty"><p>Sem leads em análise. Crie um novo lead para começar.</p></div>
      )}

      {all.length > 0 && (
        <div className="project-table">
          <div className="pt-head" style={{ gridTemplateColumns: COLS }}>
            <div className="pt-head-cell">Cliente</div>
            <div className="pt-head-cell">NIF</div>
            <div className="pt-head-cell">Programa</div>
            <div className="pt-head-cell">Estado</div>
            <div className="pt-head-cell">Criada</div>
          </div>
          {all.map((l) => (
            <LeadRow key={l.id} lead={l} onOpen={() => setSelected(l.id)} />
          ))}
        </div>
      )}

      {creating && (
        <NovoLeadModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            setSelected(id);
          }}
        />
      )}

      {selected && (
        <LeadDetalhe
          leadId={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}

function LeadRow({ lead, onOpen }: { lead: LeadListItemDTO; onOpen: () => void }) {
  return (
    <div
      className="pt-row"
      style={{ gridTemplateColumns: COLS, cursor: "pointer" }}
      onClick={onOpen}
    >
      <div className="pt-cell"><strong>{lead.clientName}</strong></div>
      <div className="pt-cell">{lead.clientNif ?? "—"}</div>
      <div className="pt-cell"><ProgramBadge program={lead.programCode} /></div>
      <div className="pt-cell">
        <span className={"badge " + ESTADO_BADGE[lead.estado]}>{LEAD_ESTADO_LABEL[lead.estado]}</span>
      </div>
      <div className="pt-cell">{new Date(lead.createdAt).toLocaleDateString("pt-PT")}</div>
    </div>
  );
}

function NovoLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [clientName, setClientName] = useState("");
  const [nif, setNif] = useState("");
  const [programCode, setProgramCode] = useState<ProgramCode>(PROGRAM_CODES[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const lead = await api.createLead({
        clientName: clientName.trim() || undefined,
        nif: nif.trim() || undefined,
        programCode,
      });
      onCreated(lead.id);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Erro ao criar a lead.");
      setBusy(false);
    }
  }

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card" onSubmit={submit}>
        <div className="dp-title">Novo lead</div>
        <p className="login-sub">
          Indique o NIF do cliente (corre o pré-diagnóstico automaticamente) e o programa.
        </p>

        <label className="login-label">Cliente (nome)</label>
        <input
          className="login-input"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Denominação social (opcional se indicar NIF)"
        />

        <label className="login-label">NIF</label>
        <input
          className="login-input"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          placeholder="Ex.: 500000000"
        />

        <label className="login-label">Programa</label>
        <Dropdown
          block
          value={programCode}
          onChange={(v) => setProgramCode(v as ProgramCode)}
          options={PROGRAM_CODES.map((c) => ({ value: c, label: c }))}
        />

        {msg && <div className="login-error">{msg}</div>}

        <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || (!nif.trim() && !clientName.trim())}>
            {busy ? "A criar…" : "Criar lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeadDetalhe({ leadId, onClose, onChanged }: { leadId: string; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const { data: lead, loading, error, reload } = useAsync(() => api.lead(leadId), [leadId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejeitarAberto, setRejeitarAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function qualificar() {
    setBusy(true);
    setMsg(null);
    try {
      const { projectId } = await api.qualificarLead(leadId);
      onChanged();
      navigate(`/projetos/${projectId}`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao qualificar.");
      setBusy(false);
    }
  }

  async function rejeitar() {
    setBusy(true);
    setMsg(null);
    try {
      await api.rejeitarLead(leadId, motivo.trim() || undefined);
      setRejeitarAberto(false);
      reload();
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro ao rejeitar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 880, width: "92%", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div className="dp-title" style={{ marginBottom: 0 }}>{lead ? lead.clientName : "Lead"}</div>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>

        {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
        {error && <ErrorState error={error} onRetry={reload} />}

        {lead && (
          <>
            <div className="cand-summary" style={{ gap: 8, margin: "10px 0 14px", flexWrap: "wrap" }}>
              <ProgramBadge program={lead.programCode} />
              <span className={"badge " + ESTADO_BADGE[lead.estado]}>{LEAD_ESTADO_LABEL[lead.estado]}</span>
              {lead.clientNif && <span className="deadline-sub">NIF {lead.clientNif}</span>}
            </div>

            {!lead.clientNif && (
              <p className="deadline-sub" style={{ marginTop: 0 }}>
                Lead sem NIF — o pré-diagnóstico não corre automaticamente.
              </p>
            )}

            <PreDiagnosticoPanel owner={{ leadId }} />

            {/* Diagnóstico completo na lead (escolha de aviso + condições de
                acesso + mérito), reutilizando o mesmo separador do projeto em
                modo lead — esconde avançar/encerrar e o estado de projeto. */}
            <div style={{ marginTop: 16 }}>
              <DiagnosticoTab leadId={leadId} />
            </div>

            {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}

            <div className="dp-actions" style={{ borderTop: "none", padding: "8px 0 0", flexWrap: "wrap", gap: 8 }}>
              {lead.estado === "qualificada" && lead.projectId ? (
                <button className="btn btn-primary" onClick={() => navigate(`/projetos/${lead.projectId}`)}>
                  Abrir projeto
                </button>
              ) : lead.estado === "analise" ? (
                <>
                  <button className="btn btn-primary" onClick={qualificar} disabled={busy}>
                    {busy ? "A qualificar…" : "Qualificar → criar projeto"}
                  </button>
                  {!rejeitarAberto && (
                    <button className="btn btn-secondary" onClick={() => setRejeitarAberto(true)} disabled={busy}>
                      Rejeitar
                    </button>
                  )}
                </>
              ) : (
                <span className="deadline-sub">Lead rejeitada.</span>
              )}
            </div>

            {lead.estado === "analise" && rejeitarAberto && (
              <div className="card" style={{ marginTop: 12, borderLeft: "3px solid var(--danger)" }}>
                <label className="merit-sub-label" htmlFor="lead-motivo">Motivo (opcional)</label>
                <textarea
                  id="lead-motivo"
                  className="login-input"
                  style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Porque é que esta lead não avança…"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" style={{ background: "var(--danger)" }} onClick={rejeitar} disabled={busy}>
                    {busy ? "A rejeitar…" : "Confirmar rejeição"}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setRejeitarAberto(false)} disabled={busy}>Cancelar</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
