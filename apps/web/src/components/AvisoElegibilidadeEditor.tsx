import { useState } from "react";
import { NUTS, type AvisoElegibilidade } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { Dropdown } from "./Dropdown.js";

/**
 * Editor (só admin) da elegibilidade estruturada de um aviso (TRNSF-1030):
 * CAE elegíveis, regiões NUTS II, baixa densidade, naturezas. Vem do PDF do
 * aviso e é validada por humano; só com estado "validado" gera Provável
 * PASSA/FALHA nas condições. Nada é inventado.
 */
export function AvisoElegibilidadeEditor({
  projectId,
  atual,
  onSaved,
}: {
  projectId: string;
  atual: AvisoElegibilidade | null;
  onSaved: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cae, setCae] = useState((atual?.caeElegiveis ?? []).join(", "));
  const [nuts2, setNuts2] = useState<string[]>(atual?.nuts2Elegiveis ?? []);
  const [baixa, setBaixa] = useState(atual?.exigeBaixaDensidade ?? false);
  const [naturezas, setNaturezas] = useState((atual?.naturezasElegiveis ?? []).join(", "));
  const [estado, setEstado] = useState<AvisoElegibilidade["estado"]>(atual?.estado ?? "por_validar");
  const [notas, setNotas] = useState(atual?.notas ?? "");
  const [fonteUrl, setFonteUrl] = useState(atual?.fonteUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggleNuts(n: string) {
    setNuts2((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }

  async function guardar() {
    setBusy(true); setErro(null);
    try {
      await api.setEligibilidade(projectId, {
        caeElegiveis: cae.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean),
        nuts2Elegiveis: nuts2,
        exigeBaixaDensidade: baixa,
        naturezasElegiveis: naturezas.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean),
        estado,
        notas: notas.trim() || null,
        fonteUrl: fonteUrl.trim() || null,
      });
      setAberto(false);
      onSaved();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao guardar.");
    } finally { setBusy(false); }
  }

  const resumo = atual
    ? `${atual.caeElegiveis.length} CAE · ${atual.nuts2Elegiveis.length} região(ões)${atual.exigeBaixaDensidade ? " · baixa densidade" : ""} · ${atual.estado === "validado" ? "validada" : "por validar"}`
    : "não definida";

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span className="deadline-sub">Elegibilidade do aviso (admin): {resumo}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : atual ? "Editar" : "Definir"}
        </button>
      </div>

      {aberto && (
        <div className="card" style={{ marginTop: 10, background: "var(--surface-2, #fafafa)" }}>
          <p className="deadline-sub" style={{ marginTop: 0 }}>
            Dados do aviso (do PDF oficial). Só com estado "Validada" geram Provável PASSA/FALHA. Nunca decidem — o estado de cada condição continua do consultor.
          </p>

          <label className="login-label">CAE elegíveis (códigos separados por vírgula; aceita prefixos, ex.: 62 cobre 62010)</label>
          <textarea className="login-input" rows={2} value={cae} onChange={(e) => setCae(e.target.value)} placeholder="ex.: 26110, 28290, 62" />

          <label className="login-label">Regiões NUTS II elegíveis</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "4px 0 8px" }}>
            {NUTS.map((n) => (
              <button
                type="button"
                key={n.nuts2}
                className={"btn btn-sm " + (nuts2.includes(n.nuts2) ? "btn-primary" : "btn-secondary")}
                onClick={() => toggleNuts(n.nuts2)}
              >
                {n.nuts2}
              </button>
            ))}
          </div>

          <label className="login-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={baixa} onChange={(e) => setBaixa(e.target.checked)} />
            Exige território de baixa densidade
          </label>

          <label className="login-label">Naturezas jurídicas elegíveis (opcional, separadas por vírgula)</label>
          <input className="login-input" value={naturezas} onChange={(e) => setNaturezas(e.target.value)} placeholder="ex.: LDA, SA, Unipessoal" />

          <label className="login-label">Fonte (URL do aviso)</label>
          <input className="login-input" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} placeholder="https://portugal2030.pt/…" />

          <label className="login-label">Notas (opcional)</label>
          <input className="login-input" value={notas} onChange={(e) => setNotas(e.target.value)} />

          <label className="login-label">Estado</label>
          <Dropdown
            block
            value={estado}
            onChange={(v) => setEstado(v as AvisoElegibilidade["estado"])}
            options={[
              { value: "por_validar", label: "Por validar (não gera Provável PASSA/FALHA)" },
              { value: "validado", label: "Validada (ativa o cruzamento determinístico)" },
            ]}
          />

          {erro && <div className="login-error" style={{ marginTop: 8 }}>{erro}</div>}
          <div className="dp-actions" style={{ borderTop: "none", padding: "12px 0 0" }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={busy} onClick={guardar}>{busy ? "A guardar…" : "Guardar elegibilidade"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
