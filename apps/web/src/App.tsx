import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Projetos } from "./pages/Projetos.js";
import { ProjectPage } from "./pages/ProjectPage.js";
import { Pt2030 } from "./pages/Pt2030.js";
import { Prazos } from "./pages/Prazos.js";
import { Clientes } from "./pages/Clientes.js";
import { ClienteDetalhe } from "./pages/ClienteDetalhe.js";
import { Utilizadores } from "./pages/Utilizadores.js";
import { Login } from "./pages/Login.js";
import { RecolhaPublica } from "./pages/RecolhaPublica.js";
import { Placeholder } from "./pages/Placeholder.js";
import { useAuth } from "./lib/auth.js";

/** Exige sessão; sem ela redireciona para /login. */
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="content">A carregar…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Exige perfil que pode gerir utilizadores; caso contrário volta ao dashboard. */
function RequireManager() {
  const { canManageUsers } = useAuth();
  if (!canManageUsers) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Formulário público do cliente — sem login (TRNSF-937) */}
      <Route path="/recolha/:token" element={<RecolhaPublica />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/projetos/:id" element={<ProjectPage />} />
          <Route path="/pt2030" element={<Pt2030 />} />
          <Route path="/prazos" element={<Prazos />} />
          <Route path="/tarefas" element={<Placeholder title="Tarefas" epic="Tarefas" />} />
          <Route path="/formacao" element={<Placeholder title="Formação Financiada" epic="Formação" />} />
          <Route path="/fiscal" element={<Placeholder title="Fiscal — RFAI / SIFIDE" epic="Fiscal" />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id" element={<ClienteDetalhe />} />
          <Route path="/definicoes" element={<Placeholder title="Definições" epic="Configuração" />} />
          <Route element={<RequireManager />}>
            <Route path="/utilizadores" element={<Utilizadores />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
