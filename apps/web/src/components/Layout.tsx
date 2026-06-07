import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "@estrategor/shared";
import { useAuth } from "../lib/auth.js";
import { GlobalSearch } from "./GlobalSearch.js";

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
  const location = useLocation();
  // sidebar como off-canvas em mobile; fecha ao navegar
  const [menuOpen, setMenuOpen] = useState(false);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const configItems: NavItem[] = [
    { to: "/clientes", label: "Clientes" },
    ...(canManageUsers ? [{ to: "/avisos", label: "Avisos" }] : []),
    ...(canManageUsers ? [{ to: "/utilizadores", label: "Utilizadores" }] : []),
    // "Definições" removido da navegação enquanto não tiver conteúdo (volta quando
    // existir Configuração real, p.ex. Programas/avisos). A rota mantém-se.
  ];

  return (
    <>
      <div className="topbar">
        <button
          className="topbar-burger"
          aria-label="Menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ☰
        </button>
        <div className="topbar-logo">
          <img
            className="topbar-logo-img"
            src="https://estrategor.pt/wp-content/uploads/2026/01/logo_estrategor_cores-1024x191.png"
            alt="Estrategor"
          />
          <span>/ Operacional</span>
        </div>
        <div className="topbar-search"><GlobalSearch /></div>
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
        {/* backdrop visível só quando o menu mobile está aberto */}
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <nav className={"sidebar" + (menuOpen ? " open" : "")} onClick={() => setMenuOpen(false)}>
          <NavSection title="Geral" items={GERAL} />
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

        <main className="main" key={location.pathname}>
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
