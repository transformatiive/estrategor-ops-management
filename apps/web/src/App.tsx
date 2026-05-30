import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Projetos } from "./pages/Projetos.js";
import { ProjectPage } from "./pages/ProjectPage.js";
import { Pt2030 } from "./pages/Pt2030.js";
import { Placeholder } from "./pages/Placeholder.js";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projetos" element={<Projetos />} />
        <Route path="/projetos/:id" element={<ProjectPage />} />
        <Route path="/pt2030" element={<Pt2030 />} />
        <Route
          path="/prazos"
          element={<Placeholder title="Prazos e Milestones" epic="TRNSF-939 (F)" />}
        />
        <Route path="/tarefas" element={<Placeholder title="Tarefas" epic="Tarefas" />} />
        <Route
          path="/formacao"
          element={<Placeholder title="Formação Financiada" epic="Formação" />}
        />
        <Route
          path="/fiscal"
          element={<Placeholder title="Fiscal — RFAI / SIFIDE" epic="Fiscal" />}
        />
        <Route
          path="/clientes"
          element={<Placeholder title="Clientes" epic="Configuração" />}
        />
        <Route
          path="/definicoes"
          element={<Placeholder title="Definições" epic="TRNSF-934 (A)" />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
