import { NavLink, Outlet } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  chip?: { text: string; variant?: "warn" | "blue" };
}

const GERAL: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projetos", label: "Projectos" },
  { to: "/prazos", label: "Prazos" },
  { to: "/tarefas", label: "Tarefas" },
];

const PROGRAMAS: NavItem[] = [
  { to: "/pt2030", label: "PT2030", chip: { text: "PT", variant: "blue" } },
  { to: "/formacao", label: "Formação" },
  { to: "/fiscal", label: "Fiscal" },
];

const CONFIGURACAO: NavItem[] = [
  { to: "/clientes", label: "Clientes" },
  { to: "/definicoes", label: "Definições" },
];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <>
      <div className="sidebar-section">{title}</div>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            "sidebar-item" + (isActive ? " active" : "")
          }
        >
          {it.label}
          {it.chip && (
            <span className={"sidebar-chip" + (it.chip.variant ? ` ${it.chip.variant}` : "")}>
              {it.chip.text}
            </span>
          )}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  return (
    <>
      <div className="topbar">
        <div className="topbar-logo">
          Estrategor <span>/ Operacional</span>
        </div>
        <div className="topbar-search">Pesquisar projecto, cliente, referência…</div>
        <div className="topbar-right">
          <div className="topbar-badge">⚠ 3 prazos próximos</div>
          <div className="topbar-avatar" title="Joana Sequeira">
            JS
          </div>
        </div>
      </div>

      <div className="layout">
        <nav className="sidebar">
          <NavSection title="Geral" items={GERAL} />
          <div className="sidebar-divider" />
          <NavSection title="Programas" items={PROGRAMAS} />
          <div className="sidebar-divider" />
          <NavSection title="Configuração" items={CONFIGURACAO} />
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="avatar-sm av-green">JS</div>
              <div>
                <div className="sidebar-user-name">Joana Sequeira</div>
                <div className="sidebar-user-role">Gestora de Projecto</div>
              </div>
            </div>
          </div>
        </nav>

        <main className="main">
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
