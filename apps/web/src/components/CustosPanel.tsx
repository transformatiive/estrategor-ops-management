import { useState } from "react";
import type {
  InvestimentosDTO,
  MapaInvestimentosPreviewDTO,
  NovaInvestimentoLinha,
  ProjectDocumentsDTO,
  ResumoExecutivoDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { ErrorState } from "./ui.js";
import { Dropdown } from "./Dropdown.js";

const eur = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €");

const EMPTY: NovaInvestimentoLinha = { designacao: "", categoria: "", elegivel: 0, ef: false, dataAquisicao: "", estabelecimento: "", atividade: "" };

/** Secção Custos / Investimentos (TRNSF-945) + Resumo Executivo. */
export function CustosPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useAsync<InvestimentosDTO>(() => api.investimentos(projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [nova, setNova] = useState<NovaInvestimentoLinha>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      reload();
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  const catLabel = (codigo: string) => data.categorias.find((c) => c.codigo === codigo)?.designacao ?? codigo;
  const coe = data.coerencia;

  return (
    <div className="card cand-section" style={{ marginBottom: 16 }}>
      <div className="cand-section-head" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span className="cand-section-name">{open ? "▾" : "▸"} Custos / Investimentos</span>
        <span className="deadline-sub">
          {data.linhas.length} linha(s) · {eur(data.totalElegivel)} elegível
          {coe.coincide === false ? " · ⚠️ diverge da financeira" : coe.coincide ? " · ✓ coincide" : ""}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {coe.coincide === false && (
            <div className="login-error" style={{ marginBottom: 10 }}>
              Investimento elegível ({eur(coe.totalElegivel)}) não coincide com o custo da componente financeira
              ({eur(coe.custoFinanceira)}); diferença {eur(coe.divergencia)}.
              {coe.faseamentoPorAno.length > 0 && (
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {coe.faseamentoPorAno.map((f) => (
                    <li key={f.ano}>{f.ano}: investimentos {eur(f.investimentos)} vs financeira {eur(f.financeira)} (Δ {eur(f.diff)})</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="fin-table" style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Designação</th><th>Categoria</th><th>Atividade/Ação</th><th>Data</th><th>Elegível</th><th>EF</th><th></th></tr>
              </thead>
              <tbody>
                {data.linhas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.designacao}</td>
                    <td>{catLabel(l.categoria)}</td>
                    <td>{l.atividade ?? "—"}</td>
                    <td>{l.dataAquisicao ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{eur(l.elegivel)}</td>
                    <td style={{ textAlign: "center" }}>{l.ef ? "✓" : ""}</td>
                    <td><button className="back-link" disabled={busy} onClick={() => run(() => api.deleteInvestimento(projectId, l.id))}>remover</button></td>
                  </tr>
                ))}
                {data.linhas.length === 0 && (
                  <tr><td colSpan={7} className="cand-empty">Sem investimentos. Adicione abaixo.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="fin-computed">
                  <td colSpan={4}>Total elegível</td>
                  <td style={{ textAlign: "right" }}>{eur(data.totalElegivel)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* nova linha */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
            <input className="login-input" style={{ flex: "2 1 160px" }} placeholder="Designação" value={nova.designacao} onChange={(e) => setNova({ ...nova, designacao: e.target.value })} />
            <Dropdown block style={{ flex: "1 1 140px" }} value={nova.categoria} onChange={(v) => setNova({ ...nova, categoria: v })} placeholder="Categoria…" options={data.categorias.map((c) => ({ value: c.codigo, label: c.designacao }))} />
            <input className="login-input" style={{ flex: "1 1 90px" }} placeholder="aaaa-mm" value={nova.dataAquisicao ?? ""} onChange={(e) => setNova({ ...nova, dataAquisicao: e.target.value })} />
            <input className="login-input" style={{ flex: "1 1 100px" }} type="number" placeholder="Elegível €" value={nova.elegivel || ""} onChange={(e) => setNova({ ...nova, elegivel: Number(e.target.value) })} />
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" checked={!!nova.ef} onChange={(e) => setNova({ ...nova, ef: e.target.checked })} /> EF
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || !nova.designacao || !nova.categoria}
              onClick={() => run(async () => { await api.addInvestimento(projectId, nova); setNova(EMPTY); })}
            >
              Adicionar
            </button>
          </div>
          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}

          <ImportarMapa projectId={projectId} onImported={() => { reload(); onChanged(); }} />

          <ResumoExecutivo projectId={projectId} />
        </div>
      )}
    </div>
  );
}

/** Importar o mapa de investimentos (Excel) → linhas de custos (TRNSF-1070). */
function ImportarMapa({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const { data: docs } = useAsync<ProjectDocumentsDTO>(() => api.documents(projectId), [projectId]);
  const [documentId, setDocumentId] = useState("");
  const [modo, setModo] = useState<"append" | "replace">("append");
  const [preview, setPreview] = useState<MapaInvestimentosPreviewDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allDocs = [...(docs?.archived ?? []), ...(docs?.queue ?? [])];

  async function previewar() {
    setBusy(true);
    setMsg(null);
    setPreview(null);
    try {
      setPreview(await api.previewMapaInvestimentos(projectId, documentId));
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível ler o mapa.");
    } finally {
      setBusy(false);
    }
  }

  async function importar() {
    if (!preview?.linhas.length) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.importarInvestimentos(projectId, preview.linhas, modo);
      setPreview(null);
      setDocumentId("");
      onImported();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="cand-section-name" style={{ marginBottom: 6 }}>Importar do mapa de investimentos (Excel)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select className="login-input" style={{ flex: "2 1 220px" }} value={documentId} onChange={(e) => { setDocumentId(e.target.value); setPreview(null); }}>
          <option value="">— Escolher Excel do projeto —</option>
          {allDocs.map((d) => (
            <option key={d.id} value={d.id}>{d.originalFilename}</option>
          ))}
        </select>
        <button className="btn btn-secondary" disabled={busy || !documentId} onClick={previewar}>Pré-visualizar</button>
      </div>

      {preview && (
        <div style={{ marginTop: 10 }}>
          {preview.nota && <div className="login-error" style={{ marginBottom: 8 }}>{preview.nota}</div>}
          {preview.linhas.length > 0 && (
            <>
              <div className="deadline-sub" style={{ marginBottom: 6 }}>{preview.linhas.length} linha(s) detetada(s):</div>
              <div style={{ overflowX: "auto" }}>
                <table className="fin-table" style={{ minWidth: 480 }}>
                  <thead><tr><th>Designação</th><th>Categoria</th><th>Data</th><th>Elegível</th><th>EF</th></tr></thead>
                  <tbody>
                    {preview.linhas.slice(0, 12).map((l, i) => (
                      <tr key={i}>
                        <td>{l.designacao}</td>
                        <td>{l.categoria || "—"}</td>
                        <td>{l.dataAquisicao ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>{eur(l.elegivel)}</td>
                        <td style={{ textAlign: "center" }}>{l.ef ? "✓" : ""}</td>
                      </tr>
                    ))}
                    {preview.linhas.length > 12 && (
                      <tr><td colSpan={5} className="deadline-sub">… e mais {preview.linhas.length - 12} linha(s).</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="radio" name="modo-imp" checked={modo === "append"} onChange={() => setModo("append")} /> Acrescentar
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="radio" name="modo-imp" checked={modo === "replace"} onChange={() => setModo("replace")} /> Substituir as existentes
                </label>
                <button className="btn btn-primary" disabled={busy} onClick={importar}>
                  Importar {preview.linhas.length} linha(s)
                </button>
              </div>
              <p className="deadline-sub" style={{ marginTop: 6 }}>
                Reveja as categorias após importar — podem vir vazias do mapa e precisam de ser associadas ao catálogo.
              </p>
            </>
          )}
        </div>
      )}
      {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function ResumoExecutivo({ projectId }: { projectId: string }) {
  const { data, loading, error } = useAsync<ResumoExecutivoDTO>(() => api.resumoExecutivo(projectId), [projectId]);
  if (loading || error || !data) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="cand-section-name" style={{ marginBottom: 6 }}>Resumo executivo</div>
      <div className="cand-summary" style={{ flexWrap: "wrap", gap: 14 }}>
        <span>Investimento elegível: <strong>{eur(data.investimentoTotalElegivel)}</strong></span>
        <span>Incentivo previsto: <strong>{eur(data.incentivoPrevisto)}</strong></span>
        {data.indicadores.map((i) => (
          <span key={i.key}>{i.label}: <strong>{i.valor == null ? "—" : i.unidade === "€" ? eur(i.valor) : i.valor}</strong></span>
        ))}
      </div>
      {data.objeto ? (
        <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "inherit", fontSize: 13 }}>
          {data.objeto.length > 500 ? data.objeto.slice(0, 500) + "…" : data.objeto}
        </pre>
      ) : (
        <p className="cand-empty">Objeto por gerar (separador de geração).</p>
      )}
      {data.pendentes.length > 0 && (
        <ul className="deadline-sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {data.pendentes.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
