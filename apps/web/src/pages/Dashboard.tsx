import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teseDoDia, type DashboardDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState, TableSkeleton } from "../components/ui.js";
import { Dropdown } from "../components/Dropdown.js";
import { useAuth } from "../lib/auth.js";
import type { AssignableUserDTO } from "@estrategor/shared";

/**
 * Dashboard de Trabalho (TRNSF-964): painel por ação — "o que tenho de fazer
 * hoje, em que projeto e porquê?". Substitui os contadores neutros e o estado
 * da API por secções de ação, agregando o pipeline (963) pela carteira.
 */
export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultor, setConsultor] = useState<string>("");
  const { data, loading, error, reload } = useAsync<DashboardDTO>(
    () => api.dashboard(consultor || undefined),
    [consultor],
  );
  // lista de utilizadores (tabela de utilizadores) para o filtro de equipa
  const { data: team } = useAsync<AssignableUserDTO[]>(() => api.assignableUsers());
  const firstName = user?.fullName.split(/\s+/)[0] ?? "";

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const fmtPrazo = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Bom dia, {firstName} 👋</div>
          <div className="page-subtitle">{data ? teseDoDia(data) : "A carregar o teu dia…"}</div>
        </div>
        {data?.isGestor && (
          <Dropdown
            style={{ maxWidth: 220 }}
            value={consultor}
            onChange={setConsultor}
            allLabel="Toda a equipa"
            options={(team ?? []).map((u) => ({ value: u.id, label: u.fullName }))}
          />
        )}
      </div>

      {data && (
        <div className="stats-grid">
          <div className="stat-card danger">
            <div className="stat-label">À minha espera</div>
            <div className="stat-value">{data.resumo.aMinhaEspera}</div>
            <div className="stat-sub">sou eu o bloqueio</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">A aguardar cliente</div>
            <div className="stat-value">{data.resumo.aguardarCliente}</div>
            <div className="stat-sub">documentos em falta</div>
          </div>
          <div className="stat-card accent">
            <div className="stat-label">Prazo esta semana</div>
            <div className="stat-value">{data.resumo.prazoEstaSemana}</div>
            <div className="stat-sub">próximos 7 dias</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Em execução</div>
            <div className="stat-value">{data.resumo.emExecucao}</div>
            <div className="stat-sub">já aprovados</div>
          </div>
        </div>
      )}

      {loading && !data && <TableSkeleton rows={4} />}

      {data && (
        <>
          {/* Secção 1 — À minha espera */}
          <div className="section-header"><div className="section-title">À minha espera</div></div>
          {data.aMinhaEspera.length === 0 ? (
            <p className="cand-empty">Nada à tua espera. 👏</p>
          ) : (
            <div className="dash-list">
              {data.aMinhaEspera.map((p) => (
                <button key={p.projectId} className="dash-row" onClick={() => navigate(`/projetos/${p.projectId}`)}>
                  <div className="dash-row-main">
                    <span className="dash-row-title">{p.title}</span>
                    <span className="deadline-sub">
                      {p.code}{p.familyLabel ? ` · ${p.familyLabel}` : ""} · {p.faseLabel}
                      {p.prazo ? ` · prazo ${fmtPrazo(p.prazo)}` : ""}
                    </span>
                  </div>
                  <div className="dash-row-falta">{p.oQueFalta.join(" · ")}</div>
                </button>
              ))}
            </div>
          )}

          {/* Secção 2 — A aguardar o cliente */}
          <div className="section-header" style={{ marginTop: 18 }}><div className="section-title">A aguardar o cliente</div></div>
          {data.aguardarCliente.length === 0 ? (
            <p className="cand-empty">Nenhum projeto parado por documentos do cliente.</p>
          ) : (
            <div className="dash-list">
              {data.aguardarCliente.map((p) => (
                <button key={p.projectId} className="dash-row" onClick={() => navigate(`/projetos/${p.projectId}`)}>
                  <div className="dash-row-main">
                    <span className="dash-row-title">{p.title}</span>
                    <span className="deadline-sub">{p.code} · {p.docsEmFalta} documento(s) em falta</span>
                  </div>
                  <div className="dash-row-falta">
                    {p.lembrete ?? "Sem lembrete enviado"} · <span className="dash-link">abrir Recolha →</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Secção 3 — Carteira por fase */}
          <div className="section-header" style={{ marginTop: 18 }}><div className="section-title">A minha carteira por fase</div></div>
          <div className="stats-grid">
            {data.carteiraPorFase.map((f) => (
              <div className="stat-card" key={f.faseKey}>
                <div className="stat-label">{f.label}</div>
                <div className="stat-value">{f.count}</div>
              </div>
            ))}
            <div className="stat-card blue">
              <div className="stat-label">Em execução</div>
              <div className="stat-value">{data.resumo.emExecucao}</div>
            </div>
          </div>
        </>
      )}

      {/* 🔴 Prazos urgentes (TRNSF-939) — mantido */}
      <div className="section-header" style={{ marginTop: 20 }}>
        <div className="section-title">🔴 Prazos urgentes</div>
      </div>
      <UrgentDeadlines />
    </>
  );
}

/** Bloco "🔴 Prazos urgentes" do dashboard (TRNSF-939). */
function UrgentDeadlines() {
  const { data, loading } = useAsync(() => api.urgentDeadlines());
  if (loading) return <p style={{ color: "var(--muted)" }}>A carregar prazos…</p>;
  const list = (data ?? []).slice(0, 6);
  if (list.length === 0) {
    return <div className="empty" style={{ padding: 20 }}><p>Sem prazos urgentes.</p></div>;
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      {list.map((d, i) => (
        <div key={i} className="deadline-item" style={{ padding: "10px 14px" }}>
          <span
            className={
              "badge " +
              (d.severity === "atrasado" ? "badge-danger" : d.severity === "urgente" ? "badge-warning" : "badge-muted")
            }
          >
            {d.daysOverdue > 0 ? `${d.daysOverdue}d` : `em ${-d.daysOverdue}d`}
          </span>
          <div className="deadline-label" style={{ marginLeft: 10 }}>
            {d.label}
            <div className="deadline-sub">
              {d.projectTitle} · {d.kind === "recolha" ? "recolha" : "prazo"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
