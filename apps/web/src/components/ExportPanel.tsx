import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

/** Exportação estruturada da candidatura (TRNSF-954): Excel/Word/PDF. */
export function ExportPanel({ projectId }: { projectId: string }) {
  const { data } = useAsync(() => api.exportStatus(projectId), [projectId]);

  const formatos: { f: "xlsx" | "docx" | "pdf"; label: string }[] = [
    { f: "xlsx", label: "Excel (tabelas)" },
    { f: "docx", label: "Word (textos)" },
    { f: "pdf", label: "PDF (consolidado)" },
  ];

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head">
        <span className="cand-section-name">Exportar candidatura</span>
      </div>
      {data && data.avisos.length > 0 && (
        <div className="login-error" style={{ marginTop: 8 }}>
          Antes de exportar:
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {data.avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          Pode exportar mesmo assim ou voltar a corrigir.
        </div>
      )}
      <div className="cand-actions" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        {formatos.map((x) => (
          <a key={x.f} className="btn btn-secondary" href={api.exportUrl(projectId, x.f)}>{x.label}</a>
        ))}
      </div>
      <p className="deadline-sub" style={{ marginTop: 8 }}>
        Os ficheiros são guardados na pasta Candidatura do WorkDrive e descarregados para copy-paste no portal SGO.
      </p>
    </div>
  );
}
