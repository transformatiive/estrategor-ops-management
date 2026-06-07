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
  fonteUrlAviso,
  onSaved,
}: {
  projectId: string;
  atual: AvisoElegibilidade | null;
  fonteUrlAviso?: string | null;
  onSaved: () => void;
}) {
  // Existindo PDF do aviso (ou elegibilidade já definida), abre por defeito —
  // é uma secção de trabalho, não um detalhe escondido.
  const [aberto, setAberto] = useState<boolean>(!!(atual || fonteUrlAviso));
  const [cae, setCae] = useState((atual?.caeElegiveis ?? []).join(", "));
  const [nuts2, setNuts2] = useState<string[]>(atual?.nuts2Elegiveis ?? []);
  const [baixa, setBaixa] = useState(atual?.exigeBaixaDensidade ?? false);
  const [naturezas, setNaturezas] = useState((atual?.naturezasElegiveis ?? []).join(", "));
  const [estado, setEstado] = useState<AvisoElegibilidade["estado"]>(atual?.estado ?? "por_validar");
  const [notas, setNotas] = useState(atual?.notas ?? "");
  const [fonteUrl, setFonteUrl] = useState(atual?.fonteUrl ?? fonteUrlAviso ?? "");
  const [busy, setBusy] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggleNuts(n: string) {
    setNuts2((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  }

  function preencherDe(e: AvisoElegibilidade) {
    setCae(e.caeElegiveis.join(", "));
    setNuts2(e.nuts2Elegiveis);
    setBaixa(e.exigeBaixaDensidade);
    setNaturezas(e.naturezasElegiveis.join(", "));
    setNotas(e.notas ?? "");
    setEstado("por_validar"); // proposta da IA entra sempre por validar
    if (e.fonteUrl) setFonteUrl(e.fonteUrl);
  }

  async function importar() {
    setImportando(true); setErro(null);
    try {
      const dto = await api.importarElegibilidade(projectId, fonteUrl.trim() || undefined);
      if (dto.eligibilidade) preencherDe(dto.eligibilidade);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao importar do PDF do aviso.");
    } finally { setImportando(false); }
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
      onSaved();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao guardar.");
    } finally { setBusy(false); }
  }

  const resumo = atual
    ? `${atual.caeElegiveis.length} CAE · ${atual.nuts2Elegiveis.length} região(ões)${atual.exigeBaixaDensidade ? " · baixa densidade" : ""} · ${atual.estado === "validado" ? "validada" : "por validar"}`
    : "não definida";

  // O PDF do aviso é lido automaticamente no pré-diagnóstico (TRNSF-1034). Se a
  // elegibilidade já está preenchida a partir de uma fonte, a importação manual
  // aqui passa a ser apenas um recurso (falha de leitura ou aviso sem PDF).
  const jaLido = !!atual && !!(atual.fonteUrl || fonteUrlAviso);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span className="deadline-sub">{resumo}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : atual ? "Editar" : "Definir"}
        </button>
      </div>

      {aberto && (
        <div className="card" style={{ marginTop: 10, background: "var(--surface-2, #fafafa)" }}>
          <p className="deadline-sub" style={{ marginTop: 0 }}>
            Dados do aviso (do PDF oficial). Só com estado "Validada" geram Provável PASSA/FALHA. Nunca decidem — o estado de cada condição continua do consultor.
          </p>

          {/* TRNSF-1032/1034 — o PDF do aviso é lido automaticamente no
              pré-diagnóstico; a importação manual aqui é um recurso. */}
          {jaLido && (
            <div
              className="deadline-sub"
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 10,
                padding: "8px 10px",
                borderRadius: 6,
                background: "var(--success-bg, #f0f9f4)",
                border: "1px solid var(--success-border, #cdebd6)",
                color: "var(--success-text, #1a7f4b)",
              }}
            >
              <span aria-hidden>✓</span>
              <span>
                O PDF do aviso já foi lido automaticamente no pré-diagnóstico — basta rever e validar abaixo.
                Só precisa de <strong>re-importar</strong> se a leitura falhou ou se o aviso não tinha PDF.
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={importar} disabled={importando || busy}>
              {importando
                ? "A importar do PDF…"
                : jaLido
                  ? "Re-importar do PDF do aviso"
                  : "Importar do PDF do aviso"}
            </button>
            <span className="deadline-sub">
              {jaLido
                ? "Recurso: re-importa só em caso de falha de leitura ou se o aviso não tinha PDF."
                : fonteUrlAviso || fonteUrl.trim()
                  ? "Usa o PDF do aviso e propõe a elegibilidade (rascunho a validar)."
                  : "Sem URL no aviso — cole o link do PDF no campo \"Fonte\" abaixo e importe."}
            </span>
          </div>

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
          <p className="deadline-sub" style={{ margin: "0 0 6px" }}>
            "Validada" liga o cruzamento: as condições de CAE/região passam a mostrar Provável PASSA/FALHA (a confirmar). "Por validar" deixa-as só com indício.
          </p>
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
