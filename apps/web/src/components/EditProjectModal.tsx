import { useEffect, useState, type FormEvent } from "react";
import {
  CAND_FAMILIES_V0,
  CAND_FAMILY_LABELS,
  PROGRAM_CODES,
  canManageUsers,
  type AssignableUserDTO,
  type ProgramCode,
  type ProjectDetailDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { Dropdown } from "./Dropdown.js";

const PROGRAM_LABELS: Record<ProgramCode, string> = {
  PT2030: "PT2030",
  RFAI: "RFAI",
  SIFIDE: "SIFIDE",
  FORMACAO: "Formação",
};

type DeleteInfo = Awaited<ReturnType<typeof api.projectDeleteInfo>>;

/**
 * Editar o cabeçalho do projeto (TRNSF-1027). RBAC: gestor/admin edita tudo;
 * consultor edita só o responsável. Apagar é exclusivo de gestor/admin e avisa
 * sempre quando há dados associados.
 */
export function EditProjectModal({
  project,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: ProjectDetailDTO;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const isManager = user ? canManageUsers(user.role) : false;

  const [title, setTitle] = useState(project.title);
  const [clientName, setClientName] = useState(project.clientName);
  const [program, setProgram] = useState<ProgramCode>(project.program as ProgramCode);
  const [family, setFamily] = useState<string>(project.family ?? "");
  const [responsavel, setResponsavel] = useState<string>(project.responsibles[0]?.id ?? "");
  const [team, setTeam] = useState<AssignableUserDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ecrã de confirmação de apagar (com resumo de dados associados)
  const [confirmDel, setConfirmDel] = useState<DeleteInfo | null>(null);

  useEffect(() => {
    api.assignableUsers().then(setTeam).catch(() => {});
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = isManager
        ? {
            title: title.trim(),
            clientName: clientName.trim(),
            program,
            family: family || null,
            responsibleIds: responsavel ? [responsavel] : [],
          }
        : { responsibleIds: responsavel ? [responsavel] : [] };
      await api.updateProject(project.id, body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function abrirApagar() {
    setError(null);
    setBusy(true);
    try {
      const info = await api.projectDeleteInfo(project.id);
      setConfirmDel(info);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  async function apagar() {
    setError(null);
    setBusy(true);
    try {
      await api.deleteProject(project.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao apagar.");
      setBusy(false);
    }
  }

  // --- Confirmação de apagar -------------------------------------------------
  if (confirmDel) {
    const linhas: string[] = [];
    if (confirmDel.documents) linhas.push(`${confirmDel.documents} documento(s)`);
    if (confirmDel.checklist) linhas.push(`${confirmDel.checklist} item(ns) de checklist`);
    if (confirmDel.deadlines) linhas.push(`${confirmDel.deadlines} prazo(s)`);
    if (confirmDel.tasks) linhas.push(`${confirmDel.tasks} tarefa(s)`);
    if (confirmDel.milestones) linhas.push(`${confirmDel.milestones} marco(s)`);
    if (confirmDel.candidatura) linhas.push("a candidatura preenchida");
    if (confirmDel.preDiagnostico) linhas.push("o pré-diagnóstico");

    return (
      <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && !busy && setConfirmDel(null)}>
        <div className="modal-card">
          <div className="dp-title">Apagar projecto</div>
          <p className="login-sub">
            <strong>{project.title}</strong> · {project.code}
          </p>
          {confirmDel.hasData ? (
            <>
              <p style={{ fontSize: 14 }}>Este projeto tem dados associados que serão apagados em definitivo:</p>
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 14 }}>
                {linhas.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </>
          ) : (
            <p style={{ fontSize: 14 }}>Este projeto não tem dados associados.</p>
          )}
          <p className="login-sub">Esta ação é irreversível.</p>
          {error && <div className="login-error">{error}</div>}
          <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmDel(null)}>
              Cancelar
            </button>
            <button type="button" className="btn" style={{ background: "var(--danger)", color: "#fff" }} disabled={busy} onClick={apagar}>
              {busy ? "A apagar…" : "Apagar definitivamente"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Edição ----------------------------------------------------------------
  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card" onSubmit={save}>
        <div className="dp-title">Editar projecto</div>
        {!isManager && (
          <p className="login-sub">Como consultor, pode alterar o responsável do projeto.</p>
        )}

        {isManager && (
          <>
            <label className="login-label">Nome do projecto</label>
            <input className="login-input" value={title} onChange={(e) => setTitle(e.target.value)} />

            <label className="login-label">Cliente</label>
            <input className="login-input" value={clientName} onChange={(e) => setClientName(e.target.value)} />

            <label className="login-label">Programa</label>
            <Dropdown
              block
              value={program}
              onChange={(v) => setProgram(v as ProgramCode)}
              options={PROGRAM_CODES.map((p) => ({ value: p, label: PROGRAM_LABELS[p] }))}
            />

            <label className="login-label">Família (opcional)</label>
            <Dropdown
              block
              value={family}
              onChange={setFamily}
              placeholder="Sem família definida"
              allLabel="Sem família definida"
              options={CAND_FAMILIES_V0.map((f) => ({ value: f, label: CAND_FAMILY_LABELS[f] }))}
            />
          </>
        )}

        <label className="login-label">Consultor responsável</label>
        <Dropdown
          block
          value={responsavel}
          onChange={setResponsavel}
          placeholder="Escolher responsável…"
          options={team.map((u) => ({ value: u.id, label: u.fullName + (u.id === user?.id ? " (eu)" : "") }))}
        />

        {/* Referência ao CRM (read-only) */}
        {project.crmDealId && (
          <>
            <label className="login-label">Oportunidade (Zoho CRM)</label>
            <input className="login-input" value={project.crmDealId} readOnly disabled />
          </>
        )}

        {error && <div className="login-error">{error}</div>}

        <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0", justifyContent: "space-between" }}>
          {isManager ? (
            <button type="button" className="back-link" style={{ color: "var(--danger, #c0392b)" }} disabled={busy} onClick={abrirApagar}>
              Apagar projecto
            </button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "A guardar…" : "Guardar"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
