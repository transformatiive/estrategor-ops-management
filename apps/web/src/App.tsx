import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Projetos } from "./pages/Projetos.js";
import { Placeholder } from "./pages/Placeholder.js";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projetos" element={<Projetos />} />
        <Route
          path="/prazos"
          element={<Placeholder title="Prazos e Milestones" epic="Épico B / Prazos" />}
        />
        <Route
          path="/tarefas"
          element={<Placeholder title="Tarefas" epic="Tarefas" />}
        />
        <Route
          path="/pt2030"
          element={<Placeholder title="PT2030 — por fase" epic="Épico B (Kanban)" />}
        />
        <Route
          path="/formacao"
          element={<Placeholder title="Formação Financiada" epic="Formação" />}
        />
        <Route
          path="/fiscal"
          element={<Placeholder title="Fiscal — RFAI / SIFIDE" epic="Fiscal" />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
