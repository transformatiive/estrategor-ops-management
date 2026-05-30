import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Avatars, ErrorState, Progress, ProgramBadge, StateBadge } from "../components/ui.js";
import { DocumentsTab } from "../components/DocumentsTab.js";
import { RecolhaTab } from "../components/RecolhaTab.js";
import { DiagnosticoTab } from "../components/DiagnosticoTab.js";
import { SeguimentoTab } from "../components/SeguimentoTab.js";

// Separadores da página de projecto. Os blocos restantes preenchem-nos nos tickets seguintes.
const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "milestones", label: "Milestones" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "recolha", label: "Recolha" },
  { key: "documentos", label: "Documentos", ticket: "TRNSF-938 (E)" },
  { key: "seguimento", label: "Checklist & Seguimento" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProjectPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("resumo");
  const { data, loading, error, reload } = useAsync(() => api.project(id), [id]);

  if (error) return <ErrorState error={error} onRetry={reload} />;

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
            {data ? `${data.clientName} · ${data.code}` : " "}
          </div>
        </div>
        {data && <StateBadge state={data.state} />}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && data && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="dp-field">
            <div className="dp-field-label">Programa</div>
            <div className="dp-field-value">
              <ProgramBadge program={data.program} /> {data.programName}
            </div>
          </div>
          <div className="dp-field">
            <div className="dp-field-label">Fase</div>
            <div className="dp-field-value">
              <StateBadge state={data.state} />
            </div>
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

      {tab === "milestones" && data && (
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

      {tab === "documentos" && <DocumentsTab projectId={id} />}
      {tab === "recolha" && <RecolhaTab projectId={id} />}
      {tab === "diagnostico" && <DiagnosticoTab projectId={id} onAdvanced={reload} />}

      {/* Separadores do bloco F: ainda por implementar */}
      {TABS.filter(
        (t) => !["resumo", "milestones", "documentos", "recolha", "diagnostico"].includes(t.key),
      ).map(
        (t) =>
          tab === t.key && (
            <div className="empty" key={t.key}>
              <p>
                <b>{t.label}</b> — por implementar.
              </p>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                {"ticket" in t ? t.ticket : ""}
              </p>
            </div>
          ),
      )}
    </>
  );
}
