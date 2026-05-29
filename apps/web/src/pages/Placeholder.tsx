/** Ecrã ainda por implementar nos próximos épicos. Mantém a navegação completa. */
export function Placeholder({ title, epic }: { title: string; epic: string }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-subtitle">A implementar — {epic}</div>
        </div>
      </div>
      <div className="empty">
        <p>Este ecrã será construído num épico seguinte da Semana 1.</p>
      </div>
    </>
  );
}
