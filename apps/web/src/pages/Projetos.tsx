import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CAND_FAMILY_LABELS,
  PIPELINE_FASES,
  STATE_BADGE_LABEL,
  STATE_TO_FASE,
  canManageUsers,
  type CandFamily,
  type ProjectListItemDTO,
} from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, EmptyState, ErrorState, Progress, ProgramBadge, TableSkeleton } from "../components/ui.js";
import { NewProjectModal } from "../components/NewProjectModal.js";
import { useAuth } from "../lib/auth.js";

type Vista = "lista" | "kanban";

const candidaturaFases = PIPELINE_FASES.filter((f) => f.bloco === "candidatura");
const execucaoFases = PIPELINE_FASES.filter((f) => f.bloco === "execucao");
const familyLabel = (f: string | null) => (f ? CAND_FAMILY_LABELS[f as CandFamily] ?? f : null);

export function Projetos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: projects, loading, error, reload } = useAsync(() => api.projects());
  const [creating, setCreating] = useState(false);
  const isManager = user ? canManageUsers(user.role) : false;

  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem("projetos-vista") as Vista) || "lista");
  const [kbloco, setKbloco] = useState<"candidatura" | "execucao">("candidatura");
  const [q, setQ] = useState("");
  const [programa, setPrograma] = useState("");
  const [fase, setFase] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [familia, setFamilia] = useState("");

  const setVistaP = (v: Vista) => { setVista(v); localStorage.setItem("projetos-vista", v); };

  const all = projects ?? [];
  const programas = useMemo(() => [...new Set(all.map((p) => p.program))].sort(), [all]);
  const responsaveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of all) for (const r of p.responsibles) m.set(r.id, r.fullName);
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (needle && !`${p.title} ${p.clientName} ${p.code}`.toLowerCase().includes(needle)) return false;
      if (programa && p.program !== programa) return false;
      if (fase && STATE_TO_FASE[p.state] !== fase) return false;
      if (responsavel && !p.responsibles.some((r) => r.id === responsavel)) return false;
      if (familia && p.family !== familia) return false;
      return true;
    });
  }, [all, q, programa, fase, responsavel, familia]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Projectos</div>
          <div className="page-subtitle">{projects ? `${filtered.length} de ${all.length} projectos` : " "}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Novo projecto</button>
      </div>

      {/* Barra de filtros */}
      <div className="filtros">
        <input className="login-input" style={{ flex: "2 1 200px" }} placeholder="Pesquisar projeto, cliente ou referência…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="login-input" value={programa} onChange={(e) => setPrograma(e.target.value)}>
          <option value="">Programa: todos</option>
          {programas.map((pg) => <option key={pg} value={pg}>{pg}</option>)}
        </select>
        <select className="login-input" value={fase} onChange={(e) => setFase(e.target.value)}>
          <option value="">Fase: todas</option>
          {PIPELINE_FASES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {isManager && (
          <select className="login-input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            <option value="">Responsável: todos</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        )}
        <select className="login-input" value={familia} onChange={(e) => setFamilia(e.target.value)}>
          <option value="">Família: todas</option>
          <option value="inovacao_produtiva">Inovação Produtiva</option>
          <option value="internacionalizacao">Internacionalização</option>
        </select>
        <div className="vista-toggle">
          <button className={"tab" + (vista === "lista" ? " active" : "")} onClick={() => setVistaP("lista")}>Lista</button>
          <button className={"tab" + (vista === "kanban" ? " active" : "")} onClick={() => setVistaP("kanban")}>Kanban</button>
        </div>
      </div>

      {loading && <TableSkeleton />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {projects && all.length === 0 && <EmptyState message="Sem projectos ainda." />}
      {projects && all.length > 0 && filtered.length === 0 && <EmptyState message="Nenhum projeto corresponde aos filtros." />}

      {/* Vista de lista */}
      {projects && vista === "lista" && filtered.length > 0 && (
        <div className="project-table">
          <div className="pt-head">
            <div className="pt-head-cell">Projecto / Cliente</div>
            <div className="pt-head-cell">Programa</div>
            <div className="pt-head-cell">Fase</div>
            <div className="pt-head-cell">Progresso</div>
            <div className="pt-head-cell">Próxima acção</div>
            <div className="pt-head-cell">Equipa</div>
          </div>
          {filtered.map((p) => (
            <div className="pt-row" key={p.id} onClick={() => navigate(`/projetos/${p.id}`)}>
              <div className="pt-cell">
                <div className="proj-name">{p.title}</div>
                <div className="proj-client">{p.clientName}{familyLabel(p.family) ? ` · ${familyLabel(p.family)}` : ""}</div>
                <div className="proj-ref">{p.code}</div>
              </div>
              <div className="pt-cell"><ProgramBadge program={p.program} /></div>
              <div className="pt-cell"><span className="badge badge-muted">{STATE_BADGE_LABEL[p.state]}</span></div>
              <div className="pt-cell"><Progress value={p.progress} /></div>
              <div className="pt-cell">{p.nextAction ?? "—"}</div>
              <div className="pt-cell"><Avatars people={p.responsibles} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Vista kanban — seletor de secção + 5 colunas */}
      {projects && vista === "kanban" && filtered.length > 0 && (
        <Kanban projetos={filtered} bloco={kbloco} onBloco={setKbloco} onOpen={(id) => navigate(`/projetos/${id}`)} />
      )}

      {creating && (
        <NewProjectModal
          onClose={() => setCreating(false)}
          onCreated={(id, foldersError) => {
            setCreating(false);
            if (foldersError) {
              alert(`Projecto criado, mas a criação de pastas falhou:\n${foldersError}\n\nPode repetir no separador Documentos.`);
              reload();
            }
            navigate(`/projetos/${id}`);
          }}
        />
      )}
    </>
  );
}

function Kanban({
  projetos,
  bloco,
  onBloco,
  onOpen,
}: {
  projetos: ProjectListItemDTO[];
  bloco: "candidatura" | "execucao";
  onBloco: (b: "candidatura" | "execucao") => void;
  onOpen: (id: string) => void;
}) {
  const fases = bloco === "candidatura" ? candidaturaFases : execucaoFases;
  const byFase: Record<string, ProjectListItemDTO[]> = Object.fromEntries(fases.map((f) => [f.key, []]));
  for (const p of projetos) {
    const fk = STATE_TO_FASE[p.state];
    if (byFase[fk]) byFase[fk].push(p);
  }

  return (
    <>
      <div className="vista-toggle" style={{ marginBottom: 12 }}>
        <button className={"tab" + (bloco === "candidatura" ? " active" : "")} onClick={() => onBloco("candidatura")}>Candidatura</button>
        <button className={"tab" + (bloco === "execucao" ? " active" : "")} onClick={() => onBloco("execucao")}>Execução</button>
      </div>
      <div className="kanban">
        {fases.map((f) => (
          <div className="kanban-col" key={f.key}>
            <div className="kanban-col-head">
              <span>{f.label}</span>
              <span className="badge badge-muted">{byFase[f.key]!.length}</span>
            </div>
            {byFase[f.key]!.map((p) => (
              <button className="kanban-card" key={p.id} onClick={() => onOpen(p.id)}>
                <div className="kanban-card-title">{p.clientName}</div>
                <div className="deadline-sub">{p.title}</div>
                <div className="kanban-card-meta">
                  {familyLabel(p.family) && <span className="badge badge-muted">{familyLabel(p.family)}</span>}
                  {p.nextAction && <span className="deadline-sub">{p.nextAction}</span>}
                </div>
              </button>
            ))}
            {byFase[f.key]!.length === 0 && <div className="kanban-empty">—</div>}
          </div>
        ))}
      </div>
    </>
  );
}
