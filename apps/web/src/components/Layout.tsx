import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "@estrategor/shared";
import { useAuth } from "../lib/auth.js";

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

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <>
      <div className="sidebar-section">{title}</div>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) => "sidebar-item" + (isActive ? " active" : "")}
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
  const { user, canManageUsers, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const configItems: NavItem[] = [
    { to: "/clientes", label: "Clientes" },
    ...(canManageUsers ? [{ to: "/utilizadores", label: "Utilizadores" }] : []),
    { to: "/definicoes", label: "Definições" },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-logo">
          Estrategor <span>/ Operacional</span>
        </div>
        <div className="topbar-search">Pesquisar projecto, cliente, referência…</div>
        <div className="topbar-right">
          {user && (
            <div className="topbar-avatar" title={user.fullName}>
              {user.initials}
            </div>
          )}
          <button className="btn btn-ghost" onClick={onLogout}>
            Sair
          </button>
        </div>
      </div>

      <div className="layout">
        <nav className="sidebar">
          <NavSection title="Geral" items={GERAL} />
          <div className="sidebar-divider" />
          <NavSection title="Programas" items={PROGRAMAS} />
          <div className="sidebar-divider" />
          <NavSection title="Configuração" items={configItems} />
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className={`avatar-sm av-${user?.color ?? "green"}`}>{user?.initials ?? "?"}</div>
              <div>
                <div className="sidebar-user-name">{user?.fullName ?? ""}</div>
                <div className="sidebar-user-role">{user ? ROLE_LABELS[user.role] : ""}</div>
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
