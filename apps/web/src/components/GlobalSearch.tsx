import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEARCH_MIN_CHARS, type SearchResultsDTO } from "@estrategor/shared";
import { api } from "../lib/api.js";

const EMPTY: SearchResultsDTO = { projetos: [], clientes: [], documentos: [], total: 0 };

/** Pesquisa global (topbar): resultados flutuantes agrupados por secção. */
export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResultsDTO>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // pesquisa com debounce
  useEffect(() => {
    const term = q.trim();
    if (term.length < SEARCH_MIN_CHARS) {
      setRes(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api.search(term).then((r) => { setRes(r); setLoading(false); }).catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // fechar ao clicar fora / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function go(path: string) {
    setOpen(false);
    setQ("");
    navigate(path);
  }

  const term = q.trim();
  const showMenu = open && term.length >= SEARCH_MIN_CHARS;

  return (
    <div className="gsearch" ref={ref}>
      <span className="gsearch-icon">⌕</span>
      <input
        className="gsearch-input"
        placeholder="Pesquisar projecto, cliente, documento…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />

      {showMenu && (
        <div className="gsearch-menu">
          {loading && res.total === 0 && <div className="gsearch-empty">A pesquisar…</div>}
          {!loading && res.total === 0 && <div className="gsearch-empty">Sem resultados para “{term}”.</div>}

          {res.projetos.length > 0 && (
            <div className="gsearch-group">
              <div className="gsearch-group-head"><span className="gsearch-gicon">📁</span> Projetos</div>
              {res.projetos.map((p) => (
                <button key={p.id} className="gsearch-item" onClick={() => go(`/projetos/${p.id}`)}>
                  <div className="gsearch-item-title">{p.title}</div>
                  <div className="gsearch-item-sub">{p.clientName} · {p.code} · {p.badgeLabel}</div>
                </button>
              ))}
            </div>
          )}

          {res.clientes.length > 0 && (
            <div className="gsearch-group">
              <div className="gsearch-group-head"><span className="gsearch-gicon">🏢</span> Clientes</div>
              {res.clientes.map((c) => (
                <button key={c.id} className="gsearch-item" onClick={() => go(`/clientes/${c.id}`)}>
                  <div className="gsearch-item-title">{c.name}</div>
                  {c.sector && <div className="gsearch-item-sub">{c.sector}</div>}
                </button>
              ))}
            </div>
          )}

          {res.documentos.length > 0 && (
            <div className="gsearch-group">
              <div className="gsearch-group-head"><span className="gsearch-gicon">📄</span> Documentos</div>
              {res.documentos.map((d) => (
                <button key={d.id} className="gsearch-item" onClick={() => go(`/projetos/${d.projectId}`)}>
                  <div className="gsearch-item-title">{d.tipo}</div>
                  <div className="gsearch-item-sub">{d.projectTitle} · {d.status === "arquivado" ? "arquivado" : "por validar"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
