import { useState, type FormEvent } from "react";
import { ROLES, ROLE_LABELS, type Role, type UserDTO } from "@estrategor/shared";
import { Dropdown } from "../components/Dropdown.js";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { EmptyState, ErrorState } from "../components/ui.js";

interface FormState {
  id?: string;
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

const EMPTY: FormState = { fullName: "", email: "", role: "CONSULTOR", password: "" };

export function Utilizadores() {
  const { data: users, loading, error, reload } = useAsync(() => api.users());
  const [form, setForm] = useState<FormState | null>(null);
  const [resetFor, setResetFor] = useState<UserDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    setBusy(true);
    try {
      if (form.id) {
        await api.updateUser(form.id, {
          fullName: form.fullName,
          email: form.email,
          role: form.role,
        });
      } else {
        await api.createUser({
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          password: form.password,
        });
      }
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: UserDTO) {
    try {
      await api.updateUser(u.id, { active: !u.active });
      reload();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Erro.");
    }
  }

  async function doReset(e: FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setFormError(null);
    setBusy(true);
    try {
      await api.resetPassword(resetFor.id, form?.password ?? "");
      setResetFor(null);
      setForm(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Erro ao repor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Utilizadores</div>
          <div className="page-subtitle">Configuração · gestão de acessos</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm({ ...EMPTY });
            setFormError(null);
          }}
        >
          + Novo utilizador
        </button>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {users && users.length === 0 && <EmptyState message="Sem utilizadores." />}

      {users && users.length > 0 && (
        <div className="project-table">
          <div className="pt-head" style={{ gridTemplateColumns: "1.6fr 2fr 1fr 1fr 1.4fr" }}>
            <div className="pt-head-cell">Nome</div>
            <div className="pt-head-cell">Email</div>
            <div className="pt-head-cell">Papel</div>
            <div className="pt-head-cell">Estado</div>
            <div className="pt-head-cell">Acções</div>
          </div>
          {users.map((u) => (
            <div
              className="pt-row"
              key={u.id}
              style={{ gridTemplateColumns: "1.6fr 2fr 1fr 1fr 1.4fr", cursor: "default" }}
            >
              <div className="pt-cell">{u.fullName}</div>
              <div className="pt-cell">{u.email}</div>
              <div className="pt-cell">
                <span className="badge badge-muted">{ROLE_LABELS[u.role]}</span>
              </div>
              <div className="pt-cell">
                <span className={"badge " + (u.active ? "badge-green" : "badge-danger")}>
                  {u.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="pt-cell" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className="back-link"
                  onClick={() => {
                    setForm({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, password: "" });
                    setFormError(null);
                  }}
                >
                  Editar
                </button>
                <button className="back-link" onClick={() => toggleActive(u)}>
                  {u.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  className="back-link"
                  onClick={() => {
                    setResetFor(u);
                    setForm({ ...EMPTY, password: "" });
                    setFormError(null);
                  }}
                >
                  Repor pw
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {form && !resetFor && (
        <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <form className="modal-card" onSubmit={save}>
            <div className="dp-title">{form.id ? "Editar utilizador" : "Novo utilizador"}</div>
            <label className="login-label">Nome</label>
            <input
              className="login-input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <label className="login-label">Papel</label>
            <Dropdown
              block
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as Role })}
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
            {!form.id && (
              <>
                <label className="login-label">Palavra-passe inicial</label>
                <input
                  className="login-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </>
            )}
            {formError && <div className="login-error">{formError}</div>}
            <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal repor palavra-passe */}
      {resetFor && (
        <div
          className="detail-overlay"
          onClick={(e) => e.target === e.currentTarget && (setResetFor(null), setForm(null))}
        >
          <form className="modal-card" onSubmit={doReset}>
            <div className="dp-title">Repor palavra-passe</div>
            <p className="login-sub">{resetFor.fullName}</p>
            <label className="login-label">Nova palavra-passe</label>
            <input
              className="login-input"
              type="password"
              value={form?.password ?? ""}
              onChange={(e) => setForm({ ...EMPTY, password: e.target.value })}
            />
            {formError && <div className="login-error">{formError}</div>}
            <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setResetFor(null);
                  setForm(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "A repor…" : "Repor"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
