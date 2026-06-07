import { useEffect, useState } from "react";
import {
  FAIXA_ESTADO_LABEL,
  FIELD_ORIGIN_LABELS,
  type FaixaEstado,
  type PreDiagCampo,
  type PreDiagnosticoDTO,
} from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

const faixaBadge = (e: FaixaEstado) =>
  e === "ok" ? "badge-green" : e === "falhou" ? "badge-danger" : "badge-muted";

/**
 * Faixas por ordem de execução, em linguagem do utilizador (sem nomes de
 * modelos). A descrição alimenta o progresso animado enquanto corre.
 */
const FAIXAS: { key: keyof PreDiagnosticoDTO["faixas"]; nome: string; desc: string }[] = [
  { key: "vies", nome: "Registo oficial", desc: "a validar o NIF e a denominação social" },
  { key: "apiEmpresas", nome: "Dados da empresa", desc: "a obter CAE, natureza jurídica, capital e localização" },
  { key: "sonar", nome: "Contexto público", desc: "a recolher contexto e fontes na web" },
  { key: "sonnet", nome: "Análise", desc: "a estruturar a leitura e a checklist a confirmar" },
];

/** Parte um texto corrido em pontos (bullets) para legibilidade. */
function emBullets(texto: string): string[] {
  return texto
    .split(/\s*;\s+|\n+|(?:\.\s+)(?=\(\d+\))/)
    .map((s) => s.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean);
}

/**
 * Pré-diagnóstico assistido por IA (TRNSF-967) no ecrã de Diagnóstico A0.
 * Rascunho com proveniência e fonte por campo; corrigível campo a campo.
 * Enquanto não validado, NÃO tem efeito (não altera estado nem elegibilidade).
 */
export function PreDiagnosticoPanel({ projectId }: { projectId: string }) {
  const { data, reload } = useAsync<PreDiagnosticoDTO>(() => api.prediagnostico(projectId), [projectId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Enquanto está a correr, faz polling para mostrar o progresso ao vivo.
  const aCorrer = data?.estado === "pendente";
  useEffect(() => {
    if (!aCorrer) return;
    const t = setInterval(() => reload(), 2000);
    return () => clearInterval(t);
  }, [aCorrer, reload]);

  // Só esconde no arranque (sem dados ainda); durante o polling mantém-se visível.
  if (!data) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { await fn(); reload(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : "Erro."); }
    finally { setBusy(false); }
  }

  const inexistente = data.estado === "inexistente";
  const concluidas = FAIXAS.filter((f) => data.faixas[f.key] !== "pendente").length;
  const aDecorrer = FAIXAS.find((f) => data.faixas[f.key] === "pendente");
  const pct = Math.round((concluidas / FAIXAS.length) * 100);

  return (
    <div className="card" style={{ marginBottom: 16, maxWidth: 820 }}>
      <div className="section-header" style={{ marginBottom: 8 }}>
        <div className="section-title" style={{ fontSize: 15 }}>Pré-diagnóstico assistido por IA</div>
        <button className="btn btn-secondary" disabled={busy || aCorrer} onClick={() => run(() => api.runPrediagnostico(projectId))}>
          {aCorrer ? "A analisar…" : inexistente ? "Correr pré-diagnóstico" : "Recorrer"}
        </button>
      </div>

      {inexistente ? (
        <p className="cand-empty" style={{ margin: 0 }}>
          Sem pré-diagnóstico. Corre automaticamente ao criar o cliente (com NIF); pode também correr aqui.
        </p>
      ) : aCorrer ? (
        // ── Progresso animado (linguagem do utilizador, sem nomes de modelos) ──
        <div className="prediag-run">
          <div className="prediag-run-head">
            <span>A analisar a empresa…</span>
            <span className="deadline-sub">{concluidas} de {FAIXAS.length}</span>
          </div>
          <div className="prediag-bar"><div className="prediag-bar-fill" style={{ width: `${pct}%` }} /></div>
          <ul className="prediag-steps">
            {FAIXAS.map((f) => {
              const st = data.faixas[f.key];
              const estado = st !== "pendente" ? "done" : f.key === aDecorrer?.key ? "running" : "todo";
              return (
                <li key={f.key} className={"prediag-step " + estado}>
                  <span className="prediag-step-icon">{estado === "done" ? "✓" : estado === "running" ? "●" : "○"}</span>
                  <span><strong>{f.nome}</strong> — {f.desc}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          {/* Estado das faixas (sem nomes de modelos) */}
          <div className="cand-summary" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {FAIXAS.map((f) => (
              <span key={f.key} className={"badge " + faixaBadge(data.faixas[f.key])}>
                {f.nome}: {FAIXA_ESTADO_LABEL[data.faixas[f.key]]}
              </span>
            ))}
            {data.executadoEm && <span className="deadline-sub">{new Date(data.executadoEm).toLocaleString("pt-PT")}</span>}
          </div>
          {/* Razão de falha por faixa (diagnóstico) */}
          {(data.faixasDetalhe?.apiEmpresas || data.faixasDetalhe?.vies) && (
            <p className="deadline-sub" style={{ marginTop: 0, marginBottom: 8 }}>
              {data.faixasDetalhe?.vies && <span>Registo oficial: {data.faixasDetalhe.vies}. </span>}
              {data.faixasDetalhe?.apiEmpresas && <span>Dados da empresa: {data.faixasDetalhe.apiEmpresas}.</span>}
            </p>
          )}
          {/* Faixas sem chave: nota de configuração (não é erro) */}
          {(data.faixas.sonar === "sem_chave" || data.faixas.sonnet === "sem_chave" || data.faixas.apiEmpresas === "sem_chave") && (
            <p className="deadline-sub" style={{ marginTop: 0, marginBottom: 8 }}>
              Faixas "Sem chave" estão desativadas por falta de credencial no ambiente (degradação graciosa) — não inventam dados.
            </p>
          )}
          <p className="deadline-sub" style={{ marginTop: 0 }}>
            Rascunho — a IA não decide elegibilidade. Reveja e corrija onde necessário; nada tem efeito sem validação.
          </p>

          {/* Campos pré-preenchidos com proveniência */}
          {data.campos.map((c) => (
            <CampoRow key={c.key} projectId={projectId} campo={c} onChanged={reload} />
          ))}
          {data.campos.length === 0 && <p className="cand-empty">Sem campos pré-preenchidos.</p>}

          {/* Checklist "a confirmar oficialmente" */}
          {data.checklistAConfirmar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="cand-section-name" style={{ marginBottom: 6 }}>A confirmar oficialmente</div>
              <ul className="prediag-checklist">
                {data.checklistAConfirmar.map((c, i) => {
                  const notas = c.nota ? emBullets(c.nota) : [];
                  return (
                    <li key={i}>
                      <strong>{c.item}</strong>
                      {notas.length === 1 && <span className="deadline-sub"> — {notas[0]}</span>}
                      {notas.length > 1 && (
                        <ul className="prediag-subbullets">
                          {notas.map((n, j) => <li key={j} className="deadline-sub">{n}</li>)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Fontes (auditoria) */}
          {data.fontesSonar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="cand-section-name" style={{ marginBottom: 6 }}>Fontes</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.fontesSonar.slice(0, 8).map((u, i) => (
                  <li key={i} style={{ fontSize: 12 }}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>
                ))}
              </ul>
            </div>
          )}

          {msg && <div className="login-error" style={{ marginTop: 8 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}

function CampoRow({ projectId, campo, onChanged }: { projectId: string; campo: PreDiagCampo; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(campo.value ?? ""));
  const [busy, setBusy] = useState(false);

  const temValor = campo.value !== null && campo.value !== undefined && String(campo.value).trim() !== "";
  // Verde quando há valor (provável correto); ✏️ se já foi corrigido; senão neutro.
  const icon = campo.estado === "corrigido" ? "✏️" : temValor ? "🟢" : "🟡";
  // Leitura da IA pode vir em texto corrido — apresentar em bullets se fizer sentido.
  const partes = campo.origem === "pre_diagnostico_ia" && typeof campo.value === "string" ? emBullets(campo.value) : [];

  async function corrigir() {
    setBusy(true);
    try {
      await api.updatePrediagCampo(projectId, { key: campo.key, action: "corrigir", value: val });
      setEditing(false);
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="cand-field">
      <div className="cand-field-main">
        <span className="cand-field-key">{campo.label}</span>
        <span className="cand-field-prov" title={campo.fonte ?? undefined}>
          {icon} {FIELD_ORIGIN_LABELS[campo.origem]}
          {campo.fonte ? <span className="deadline-sub"> · {campo.fonte}</span> : null}
        </span>
      </div>
      {editing ? (
        <div className="cand-field-edit">
          <input className="login-input" value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={corrigir}>Guardar</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="cand-field-value">
          {partes.length > 1 ? (
            <ul className="prediag-bullets">{partes.map((p, i) => <li key={i}>{p}</li>)}</ul>
          ) : (
            <span>{String(campo.value ?? "—")}</span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Corrigir</button>
        </div>
      )}
    </div>
  );
}
