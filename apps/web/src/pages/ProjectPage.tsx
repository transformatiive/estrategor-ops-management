import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VISTA_LABELS, vistasDaFase, type PipelineDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, ErrorState, Progress, ProgramBadge } from "../components/ui.js";
import { DocumentsTab } from "../components/DocumentsTab.js";
import { RecolhaTab } from "../components/RecolhaTab.js";
import { DiagnosticoTab } from "../components/DiagnosticoTab.js";
import { SeguimentoTab } from "../components/SeguimentoTab.js";
import { CandidaturaTab } from "../components/CandidaturaTab.js";
import { ExtracaoTab } from "../components/ExtracaoTab.js";
import { PipelinePanel } from "../components/PipelinePanel.js";
import { ProjectDeadlines } from "../components/ProjectDeadlines.js";

export function ProjectPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.project(id), [id]);
  const { data: pipe, reload: reloadPipe } = useAsync<PipelineDTO>(() => api.pipeline(id), [id]);

  // fase em foco (default = fase atual do projeto) e vista dentro dessa fase
  const [faseSel, setFaseSel] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);

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
        {pipe && <span className="badge badge-muted">{pipe.badgeLabel}</span>}
      </div>

      {/* Pipeline em linguagem de cliente (TRNSF-963) */}
      {pipe && <PipelinePanel pipe={pipe} faseSelecionada={faseAtual} onSelect={selectFase} />}

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
          <div className="dp-field">
            <div className="dp-field-label">Próxima acção</div>
            <div className="dp-field-value">{data.nextAction ?? "—"}</div>
          </div>
        </div>
      )}

      {vistaAtiva === "resumo" && data && <ProjectDeadlines projectId={id} />}

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
      {vistaAtiva === "extracao" && <ExtracaoTab projectId={id} />}
      {vistaAtiva === "documentos" && <DocumentsTab projectId={id} />}
      {vistaAtiva === "recolha" && <RecolhaTab projectId={id} />}
      {vistaAtiva === "diagnostico" && (
        <DiagnosticoTab projectId={id} onAdvanced={() => { reload(); reloadPipe(); }} />
      )}
      {vistaAtiva === "seguimento" && <SeguimentoTab projectId={id} />}
    </>
  );
}
