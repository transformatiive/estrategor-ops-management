import { useEffect, useState, type FormEvent } from "react";
import { PROGRAM_CODES, type AssignableUserDTO, type ProgramCode } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";

const PROGRAM_LABELS: Record<ProgramCode, string> = {
  PT2030: "PT2030",
  RFAI: "RFAI",
  SIFIDE: "SIFIDE",
  FORMACAO: "Formação",
};

/** Modal de criação manual de projecto (B-02 / TRNSF-936). Ao criar, a API
 *  provisiona a estrutura de pastas no WorkDrive. */
export function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, foldersError: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientNif, setClientNif] = useState("");
  const [program, setProgram] = useState<ProgramCode>("PT2030");
  const [measureLabel, setMeasureLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { user } = useAuth();
  const [team, setTeam] = useState<AssignableUserDTO[]>([]);
  const [responsavel, setResponsavel] = useState<string>(user?.id ?? "");
  useEffect(() => {
    api.assignableUsers().then((list) => {
      setTeam(list);
      // default: o utilizador atual; senão o primeiro
      setResponsavel((cur) => cur || user?.id || list[0]?.id || "");
    }).catch(() => {});
  }, [user?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !clientName.trim()) {
      setError("Título e cliente são obrigatórios.");
      return;
    }
    if (!responsavel) {
      setError("Indique o consultor responsável.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.createProject({
        title: title.trim(),
        clientName: clientName.trim(),
        clientNif: clientNif.trim() || undefined,
        program,
        measureLabel: program === "PT2030" ? measureLabel.trim() || undefined : undefined,
        responsibleIds: [responsavel],
      });
      onCreated(res.id, res.foldersError);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar projecto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal-card" onSubmit={submit}>
        <div className="dp-title">Novo projecto</div>
        <p className="login-sub">Cria o projecto e a estrutura de pastas no WorkDrive.</p>

        <label className="login-label">Título</label>
        <input className="login-input" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="login-label">Cliente</label>
        <input
          className="login-input"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />

        <label className="login-label">NIF (opcional)</label>
        <input className="login-input" value={clientNif} onChange={(e) => setClientNif(e.target.value)} />

        <label className="login-label">Consultor responsável</label>
        <select className="login-input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          {team.length === 0 && <option value="">—</option>}
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}{u.id === user?.id ? " (eu)" : ""}
            </option>
          ))}
        </select>

        <label className="login-label">Programa</label>
        <select
          className="login-input"
          value={program}
          onChange={(e) => setProgram(e.target.value as ProgramCode)}
        >
          {PROGRAM_CODES.map((p) => (
            <option key={p} value={p}>
              {PROGRAM_LABELS[p]}
            </option>
          ))}
        </select>

        {program === "PT2030" && (
          <>
            <label className="login-label">Medida / aviso (opcional)</label>
            <input
              className="login-input"
              placeholder="ex.: SI Qualificação nº 0182"
              value={measureLabel}
              onChange={(e) => setMeasureLabel(e.target.value)}
            />
          </>
        )}

        {error && <div className="login-error">{error}</div>}

        <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "A criar…" : "Criar projecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
