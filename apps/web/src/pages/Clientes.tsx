import { useNavigate } from "react-router-dom";
import type { ClientListItemDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "../components/ui.js";

/** Clientes com projetos em curso (candidatura ou execução). */
export function Clientes() {
  const { data, loading, error, reload } = useAsync<ClientListItemDTO[]>(() => api.clients());
  const navigate = useNavigate();

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">Clientes com projetos em curso</div>
        </div>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <div className="empty"><p>Sem clientes com projetos em curso.</p></div>
      )}

      {data && data.length > 0 && (
        <div className="project-table">
          <div className="pt-head" style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr" }}>
            <div className="pt-head-cell">Cliente</div>
            <div className="pt-head-cell">Setor</div>
            <div className="pt-head-cell">NIF</div>
            <div className="pt-head-cell">Projetos em curso</div>
          </div>
          {data.map((c) => (
            <div
              key={c.id}
              className="pt-row"
              style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr", cursor: "pointer" }}
              onClick={() => navigate(`/clientes/${c.id}`)}
            >
              <div className="pt-cell"><strong>{c.name}</strong></div>
              <div className="pt-cell">{c.sector ?? "—"}</div>
              <div className="pt-cell">{c.nif ?? "—"}</div>
              <div className="pt-cell">{c.numProjetos}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
