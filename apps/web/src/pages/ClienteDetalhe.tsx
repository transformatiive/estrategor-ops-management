import { useNavigate, useParams } from "react-router-dom";
import type { ClientDetailDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState, ProgramBadge, Progress } from "../components/ui.js";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-PT");

/** Detalhe do cliente: dados + projetos em curso + documentação associada. */
export function ClienteDetalhe() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync<ClientDetailDTO>(() => api.client(id), [id]);

  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <div className="project-page-header">
        <button className="back-link" onClick={() => navigate("/clientes")}>← Clientes</button>
      </div>
      <div className="page-header">
        <div>
          <div className="page-title">{data?.name ?? (loading ? "A carregar…" : "")}</div>
          <div className="page-subtitle">
            {data ? `${data.sector ?? "Setor —"}${data.nif ? ` · NIF ${data.nif}` : ""}` : " "}
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Projetos em curso */}
          <div className="section-header"><div className="section-title">Projetos em curso</div></div>
          <div className="project-table" style={{ marginBottom: 20 }}>
            <div className="pt-head" style={{ gridTemplateColumns: "2fr 1fr 1.4fr 1fr" }}>
              <div className="pt-head-cell">Projeto</div>
              <div className="pt-head-cell">Programa</div>
              <div className="pt-head-cell">Fase</div>
              <div className="pt-head-cell">Progresso</div>
            </div>
            {data.projetos.map((p) => (
              <div key={p.id} className="pt-row" style={{ gridTemplateColumns: "2fr 1fr 1.4fr 1fr", cursor: "pointer" }} onClick={() => navigate(`/projetos/${p.id}`)}>
                <div className="pt-cell">
                  <strong>{p.title}</strong>
                  <div className="deadline-sub">{p.code}{p.family ? ` · ${p.family === "inovacao_produtiva" ? "Inovação Produtiva" : "Internacionalização"}` : ""}</div>
                </div>
                <div className="pt-cell"><ProgramBadge program={p.programCode} /></div>
                <div className="pt-cell"><span className="badge badge-muted">{p.badgeLabel}</span></div>
                <div className="pt-cell" style={{ maxWidth: 160 }}><Progress value={p.progress} /></div>
              </div>
            ))}
          </div>

          {/* Documentação associada */}
          <div className="section-header"><div className="section-title">Documentação ({data.documentos.length})</div></div>
          {data.documentos.length === 0 ? (
            <div className="empty"><p>Sem documentos arquivados.</p></div>
          ) : (
            <div className="project-table">
              <div className="pt-head" style={{ gridTemplateColumns: "2fr 1.6fr 1fr 1fr" }}>
                <div className="pt-head-cell">Documento</div>
                <div className="pt-head-cell">Projeto</div>
                <div className="pt-head-cell">Estado</div>
                <div className="pt-head-cell">Data</div>
              </div>
              {data.documentos.map((d) => (
                <div key={d.id} className="pt-row" style={{ gridTemplateColumns: "2fr 1.6fr 1fr 1fr" }}>
                  <div className="pt-cell">
                    {d.workdriveUrl ? <a href={d.workdriveUrl} target="_blank" rel="noreferrer">{d.tipo}</a> : d.tipo}
                  </div>
                  <div className="pt-cell">{d.projectTitle}</div>
                  <div className="pt-cell">
                    <span className={"badge " + (d.status === "arquivado" ? "badge-green" : "badge-warning")}>
                      {d.status === "arquivado" ? "Arquivado" : "Por validar"}
                    </span>
                  </div>
                  <div className="pt-cell">{fmtDate(d.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
