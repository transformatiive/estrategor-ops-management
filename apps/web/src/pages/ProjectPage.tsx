import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VISTA_LABELS, vistasDaFase, type PipelineDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, ErrorState, Progress, ProgramBadge } from "../components/ui.js";
import { DocumentsTab } from "../components/DocumentsTab.js";
import { DiagnosticoTab } from "../components/DiagnosticoTab.js";
import { SeguimentoTab } from "../components/SeguimentoTab.js";
import { CandidaturaTab } from "../components/CandidaturaTab.js";
import { ContextoPanel } from "../components/ContextoPanel.js";
import { ExtracaoTab } from "../components/ExtracaoTab.js";
import { PipelinePanel } from "../components/PipelinePanel.js";
import { FaseAcoesPanel } from "../components/FaseAcoesPanel.js";
import { ProjectDeadlines } from "../components/ProjectDeadlines.js";
import { EditProjectModal } from "../components/EditProjectModal.js";

export function ProjectPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.project(id), [id]);
  const { data: pipe, reload: reloadPipe } = useAsync<PipelineDTO>(() => api.pipeline(id), [id]);

  // fase em foco (default = fase atual do projeto) e vista dentro dessa fase
  const [faseSel, setFaseSel] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const faseAtual = faseSel ?? pipe?.faseAtual ?? "diagnostico";
  const vistas = vistasDaFase(faseAtual);
  const vistaAtiva = vista && vistas.includes(vista) ? vista : (vistas[0] ?? "resumo");

  function selectFase(faseKey: string) {
    setFaseSel(faseKey);
    setVista(vistasDaFase(faseKey)[0] ?? "resumo");
  }

  return (
    <>
      <div className="project-page-header">
        <button className="back-link" onClick={() => navigate("/projetos")}>
          ← Projectos
        </button>
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">{data?.title ?? (loading ? "A carregar…" : "")}</div>
          <div className="page-subtitle">
            {data ? `${data.clientName} · ${data.code}` : " "}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pipe && <span className="badge badge-muted">{pipe.badgeLabel}</span>}
          {data && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Editar</button>
          )}
        </div>
      </div>

      {editing && data && (
        <EditProjectModal
          project={data}
          onClose={() => setEditing(false)}
          onSaved={() => { reload(); reloadPipe(); }}
          onDeleted={() => navigate("/projetos")}
        />
      )}

      {/* Pipeline em linguagem de cliente (TRNSF-963) */}
      {pipe && <PipelinePanel pipe={pipe} faseSelecionada={faseAtual} onSelect={selectFase} />}

      {/* Ações de transição da cauda da Candidatura (TRNSF-1067), só na fase atual */}
      {pipe && faseAtual === pipe.faseAtual && (
        <FaseAcoesPanel
          projectId={id}
          faseAtual={faseAtual}
          onChanged={() => { setFaseSel(null); setVista(null); reload(); reloadPipe(); }}
        />
      )}

      {/* Vistas da fase selecionada */}
      <div className="tabs">
        {vistas.map((v) => (
          <button
            key={v}
            className={"tab" + (v === vistaAtiva ? " active" : "")}
            onClick={() => setVista(v)}
          >
            {VISTA_LABELS[v] ?? v}
          </button>
        ))}
      </div>

      {vistaAtiva === "resumo" && data && (
        <div className="two-col">
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="dp-field">
            <div className="dp-field-label">Programa</div>
            <div className="dp-field-value">
              <ProgramBadge program={data.program} /> {data.programName}
            </div>
          </div>
          <div className="dp-field">
            <div className="dp-field-label">Fase</div>
            <div className="dp-field-value">{pipe?.badgeLabel ?? "—"}</div>
          </div>
          <div className="dp-field">
            <div className="dp-field-label">Responsável</div>
            <div className="dp-field-value">
              <Avatars people={data.responsibles} />
            </div>
          </div>
          <div className="dp-field">
            <div className="dp-field-label">Progresso</div>
            <div className="dp-field-value" style={{ maxWidth: 200 }}>
              <Progress value={data.progress} />
            </div>
          </div>
          {/* "Próxima acção" removida: o que falta para avançar já aparece no
              pipeline acima (TRNSF-963), tornando este campo redundante. */}
        </div>
          <ProjectDeadlines projectId={id} />
        </div>
      )}

      {vistaAtiva === "milestones" && data && (
        <div className="milestone-list" style={{ maxWidth: 560 }}>
          {data.milestones.map((m) => (
            <div className="milestone-item" key={m.id}>
              <div
                className={
                  "milestone-icon " +
                  (m.status === "FEITO" ? "mi-done" : m.status === "ATIVO" ? "mi-active" : "mi-todo")
                }
              >
                {m.status === "FEITO" ? "✓" : m.status === "ATIVO" ? "●" : "○"}
              </div>
              <div className="milestone-name">{m.name}</div>
              <div className="milestone-date">{m.date ?? ""}</div>
            </div>
          ))}
        </div>
      )}

      {vistaAtiva === "candidatura" && <CandidaturaTab projectId={id} />}
      {vistaAtiva === "contexto" && <ContextoPanel projectId={id} />}
      {vistaAtiva === "extracao" && <ExtracaoTab projectId={id} />}
      {vistaAtiva === "documentos" && <DocumentsTab projectId={id} />}
      {vistaAtiva === "diagnostico" && (
        <DiagnosticoTab
          projectId={id}
          onAdvanced={() => {
            // Ao concluir o diagnóstico, a UI passa a seguir a nova fase do
            // projeto: limpa a seleção manual de fase/vista para acompanhar o
            // estado atualizado (A0 → A1 / Recolha), em vez de ficar presa.
            setFaseSel(null);
            setVista(null);
            reload();
            reloadPipe();
          }}
          onChanged={() => {
            // Guardar / escolher aviso / sugerir mérito: atualiza o pipeline
            // ("O que falta") e o progresso sem mudar de fase (TRNSF-1048).
            reload();
            reloadPipe();
          }}
        />
      )}
      {vistaAtiva === "seguimento" && <SeguimentoTab projectId={id} />}
    </>
  );
}
