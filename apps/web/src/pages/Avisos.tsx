import { useState } from "react";
import type { AvisoAdminListItemDTO, AvisoFullDTO } from "@estrategor/shared";
import { api, ApiError } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { EmptyState, ErrorState, ProgramBadge } from "../components/ui.js";
import { AvisoEditor } from "../components/AvisoEditor.js";

/**
 * Catálogo de avisos (TRNSF-1038): admin cria/gere avisos (a grelha de mérito,
 * condições de acesso e elegibilidade), importa a proposta do PDF e corrige no
 * editor visual. Só avisos PUBLICADOS (extracted=true) ficam disponíveis aos
 * consultores; rascunhos (por publicar) não.
 */
export function Avisos() {
  const {
    data: avisos,
    loading,
    error,
    reload,
  } = useAsync(() => api.listAvisos());
  const [editar, setEditar] = useState<AvisoFullDTO | null | "novo">(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [sync, setSync] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function sincronizar2030() {
    setSync(true);
    setSyncMsg(null);
    try {
      const r = await api.buildAvisos2030(5);
      setSyncMsg(
        `PT2030: ${r.abertos} avisos abertos · ${r.criadas} grelha(s) nova(s) (rascunho), ${r.ignoradas} já existiam, ${r.erros} erro(s).`,
      );
      reload();
    } catch (e) {
      setSyncMsg(e instanceof ApiError ? e.message : "Erro ao sincronizar os avisos PT2030.");
    } finally {
      setSync(false);
    }
  }

  async function abrirEditor(id: string) {
    setAcao(id);
    try {
      const full = await api.getAviso(id);
      setEditar(full);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Erro ao abrir o aviso.");
    } finally {
      setAcao(null);
    }
  }

  async function togglePublicar(a: AvisoAdminListItemDTO) {
    setAcao(a.id);
    try {
      const full = await api.getAviso(a.id);
      await api.updateAviso(a.id, {
        programCode: full.programCode,
        measure: full.measure,
        codigoAviso: full.codigoAviso,
        regiao: full.regiao,
        versao: full.versao,
        fonteUrl: full.fonteUrl,
        mpMinimo: full.mpMinimo,
        minimoPorCriterio: full.minimoPorCriterio,
        formulaMp: full.formulaMp,
        grid: full.grid,
        accessConditions: full.accessConditions,
        eligibilidade: full.eligibilidade,
        extracted: !a.extracted,
      });
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Erro ao alterar o estado.");
    } finally {
      setAcao(null);
    }
  }

  async function apagar(a: AvisoAdminListItemDTO) {
    if (!confirm(`Apagar o aviso ${a.codigoAviso}? Esta ação é irreversível.`))
      return;
    setAcao(a.id);
    try {
      await api.deleteAviso(a.id);
      reload();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Erro ao apagar.");
    } finally {
      setAcao(null);
    }
  }

  const cols = "0.9fr 1.6fr 0.9fr 0.8fr 1fr 1.1fr 1.6fr";

  // Editor em ecrã próprio (TRNSF-1072): em vez de modal, ocupa a página com
  // "voltar à listagem". Mostra-se a listagem OU o editor.
  if (editar !== null) {
    return (
      <AvisoEditor
        aviso={editar === "novo" ? null : editar}
        onClose={() => setEditar(null)}
        onSaved={() => {
          setEditar(null);
          reload();
        }}
      />
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Avisos</div>
          <div className="page-subtitle">
            Configuração · catálogo de avisos e grelhas de mérito
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={sincronizar2030} disabled={sync}>
            {sync ? "A sincronizar…" : "Sincronizar PT2030"}
          </button>
          <button className="btn btn-primary" onClick={() => setEditar("novo")}>
            + Novo aviso
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="deadline-sub" style={{ marginBottom: 10 }}>
          {syncMsg} As grelhas novas entram como <strong>rascunho</strong> — abra cada uma para rever e publicar.
        </div>
      )}

      {loading && <p style={{ color: "var(--muted)" }}>A carregar…</p>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {avisos && avisos.length === 0 && (
        <EmptyState message="Sem avisos. Crie um novo ou importe a grelha do PDF." />
      )}

      {avisos && avisos.length > 0 && (
        <div className="project-table">
          <div className="pt-head" style={{ gridTemplateColumns: cols }}>
            <div className="pt-head-cell">Programa</div>
            <div className="pt-head-cell">Código / Medida</div>
            <div className="pt-head-cell">Região</div>
            <div className="pt-head-cell">Versão</div>
            <div className="pt-head-cell">Estado</div>
            <div className="pt-head-cell">Grelha</div>
            <div className="pt-head-cell">Acções</div>
          </div>
          {avisos.map((a) => (
            <div
              className="pt-row"
              key={a.id}
              style={{ gridTemplateColumns: cols, cursor: "default" }}
            >
              <div className="pt-cell">
                <ProgramBadge program={a.programCode} />
              </div>
              <div className="pt-cell">
                <div>{a.codigoAviso}</div>
                <div className="deadline-sub" style={{ fontSize: 11 }}>
                  {a.measure}
                </div>
              </div>
              <div className="pt-cell">{a.regiao ?? "—"}</div>
              <div className="pt-cell">{a.versao}</div>
              <div className="pt-cell">
                <span
                  className={
                    "badge " + (a.extracted ? "badge-green" : "badge-warning")
                  }
                >
                  {a.extracted ? "Publicado" : "Por publicar"}
                </span>
              </div>
              <div className="pt-cell">
                <span className="deadline-sub" style={{ fontSize: 11 }}>
                  {a.nCriterios} crit. · {a.nCondicoes} cond.
                  <br />
                  eleg.:{" "}
                  {a.eligibilidadeEstado === "validado"
                    ? "validada"
                    : a.eligibilidadeEstado === "por_validar"
                      ? "por validar"
                      : "—"}
                </span>
              </div>
              <div
                className="pt-cell"
                style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
              >
                <button
                  className="back-link"
                  onClick={() => abrirEditor(a.id)}
                  disabled={acao === a.id}
                >
                  Editar
                </button>
                <button
                  className="back-link"
                  onClick={() => togglePublicar(a)}
                  disabled={acao === a.id}
                >
                  {a.extracted ? "Despublicar" : "Publicar"}
                </button>
                <button
                  className="back-link"
                  onClick={() => apagar(a)}
                  disabled={acao === a.id}
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </>
  );
}
