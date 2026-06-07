import { useMemo, useState } from "react";
import {
  PROGRAM_CODES,
  NUTS,
  computeMerit,
  gridRegions,
  parseMeritGrid,
  type AccessCondition,
  type AvisoElegibilidadeLike,
  type AvisoFullDTO,
  type MeritCriterion,
  type MeritGridData,
  type MeritOption,
  type MeritSelection,
  type MeritSubcriterion,
} from "@estrategor/shared";
import { api, ApiError, type SaveAvisoBody } from "../lib/api.js";
import { Dropdown } from "./Dropdown.js";

/**
 * Editor visual de um aviso (TRNSF-1038). Cria/edita do zero ou a partir da
 * proposta da IA (importação do PDF). LINHA VERMELHA: a IA propõe, o admin
 * corrige e valida. Guardar mantém o aviso como RASCUNHO (extracted=false);
 * publicar (extracted=true) é uma ação explícita que o torna visível aos
 * consultores. Tudo é sempre editável; nada é auto-publicado.
 */

const NUTS2 = NUTS.map((n) => n.nuts2);

function slug(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "cond"
  );
}

function gridVazia(programCode: string): MeritGridData {
  return {
    programa: programCode,
    medida: "",
    codigo_aviso: "",
    regiao: null,
    versao: "",
    escala: {
      min: 1,
      max: 5,
      descritores: {
        "1": "Muito insuficiente",
        "3": "Suficiente",
        "5": "Muito bom",
      },
    },
    mp_minimo: 3,
    minimo_por_criterio: 3,
    formula_mp: "",
    criterios: [],
  };
}

export interface AvisoEditorValue {
  programCode: string;
  measure: string;
  codigoAviso: string;
  regiao: string | null;
  versao: string;
  fonteUrl: string;
  mpMinimo: number | null;
  minimoPorCriterio: number | null;
  formulaMp: string;
  grid: MeritGridData;
  accessConditions: AccessCondition[];
  eligibilidade: AvisoElegibilidadeLike | null;
  extracted: boolean;
}

function fromFull(a: AvisoFullDTO): AvisoEditorValue {
  return {
    programCode: a.programCode,
    measure: a.measure,
    codigoAviso: a.codigoAviso,
    regiao: a.regiao,
    versao: a.versao,
    fonteUrl: a.fonteUrl ?? "",
    mpMinimo: a.mpMinimo,
    minimoPorCriterio: a.minimoPorCriterio,
    formulaMp: a.formulaMp ?? a.grid.formula_mp ?? "",
    grid: a.grid,
    accessConditions: a.accessConditions,
    eligibilidade: a.eligibilidade,
    extracted: a.extracted,
  };
}

function emptyValue(): AvisoEditorValue {
  return {
    programCode: "PT2030",
    measure: "",
    codigoAviso: "",
    regiao: null,
    versao: "",
    fonteUrl: "",
    mpMinimo: 3,
    minimoPorCriterio: 3,
    formulaMp: "",
    grid: gridVazia("PT2030"),
    accessConditions: [],
    eligibilidade: null,
    extracted: false,
  };
}

export function AvisoEditor({
  aviso,
  onClose,
  onSaved,
}: {
  aviso: AvisoFullDTO | null; // null = novo
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<AvisoEditorValue>(
    aviso ? fromFull(aviso) : emptyValue(),
  );
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState(aviso?.fonteUrl ?? "");
  const [importando, setImportando] = useState(false);
  const [jsonModo, setJsonModo] = useState(false);
  const [jsonTexto, setJsonTexto] = useState("");
  const [jsonErro, setJsonErro] = useState<string | null>(null);

  // mantém a grelha coerente com os metadados ao gravar (também usado no preview)
  const grid: MeritGridData = useMemo(
    () => ({
      ...v.grid,
      programa: v.programCode,
      medida: v.measure,
      codigo_aviso: v.codigoAviso,
      regiao: v.regiao,
      versao: v.versao,
      mp_minimo: v.mpMinimo ?? v.grid.mp_minimo,
      minimo_por_criterio: v.minimoPorCriterio ?? v.grid.minimo_por_criterio,
      formula_mp: v.formulaMp,
      fonte_url: v.fonteUrl || undefined,
    }),
    [v],
  );

  const validacao = useMemo(() => parseMeritGrid(grid), [grid]);

  function patch(p: Partial<AvisoEditorValue>) {
    setV((cur) => ({ ...cur, ...p }));
  }
  function patchGrid(p: Partial<MeritGridData>) {
    setV((cur) => ({ ...cur, grid: { ...cur.grid, ...p } }));
  }

  // ── Critérios ──────────────────────────────────────────────────────────
  function setCriterios(criterios: MeritCriterion[]) {
    patchGrid({ criterios });
  }
  function addCriterio() {
    setCriterios([
      ...grid.criterios,
      {
        codigo: "",
        nome: "",
        peso: 0,
        subcriterios: [
          { codigo: "", nome: "", options: [{ label: "", pts: 1 }] },
        ],
      },
    ]);
  }
  function updCriterio(i: number, p: Partial<MeritCriterion>) {
    setCriterios(
      grid.criterios.map((c, idx) => (idx === i ? { ...c, ...p } : c)),
    );
  }
  function delCriterio(i: number) {
    setCriterios(grid.criterios.filter((_, idx) => idx !== i));
  }
  function addSub(ci: number) {
    const c = grid.criterios[ci]!;
    updCriterio(ci, {
      subcriterios: [
        ...c.subcriterios,
        { codigo: "", nome: "", options: [{ label: "", pts: 1 }] },
      ],
    });
  }
  function updSub(ci: number, si: number, p: Partial<MeritSubcriterion>) {
    const c = grid.criterios[ci]!;
    updCriterio(ci, {
      subcriterios: c.subcriterios.map((s, idx) =>
        idx === si ? { ...s, ...p } : s,
      ),
    });
  }
  function delSub(ci: number, si: number) {
    const c = grid.criterios[ci]!;
    updCriterio(ci, {
      subcriterios: c.subcriterios.filter((_, idx) => idx !== si),
    });
  }
  function toggleRegional(ci: number, si: number) {
    const s = grid.criterios[ci]!.subcriterios[si]!;
    if (s.regionalOptions) {
      // volta a opções simples
      const primeira = Object.values(s.regionalOptions)[0] ?? [
        { label: "", pts: 1 },
      ];
      updSub(ci, si, { regionalOptions: undefined, options: primeira });
    } else {
      updSub(ci, si, {
        options: undefined,
        regionalOptions: { Norte: s.options ?? [{ label: "", pts: 1 }] },
      });
    }
  }
  function setOptions(ci: number, si: number, options: MeritOption[]) {
    updSub(ci, si, { options });
  }
  function setRegionOptions(
    ci: number,
    si: number,
    regiao: string,
    opts: MeritOption[],
  ) {
    const s = grid.criterios[ci]!.subcriterios[si]!;
    updSub(ci, si, {
      regionalOptions: { ...(s.regionalOptions ?? {}), [regiao]: opts },
    });
  }
  function addRegion(ci: number, si: number, regiao: string) {
    const s = grid.criterios[ci]!.subcriterios[si]!;
    if (!regiao || s.regionalOptions?.[regiao]) return;
    updSub(ci, si, {
      regionalOptions: {
        ...(s.regionalOptions ?? {}),
        [regiao]: [{ label: "", pts: 1 }],
      },
    });
  }
  function delRegion(ci: number, si: number, regiao: string) {
    const s = grid.criterios[ci]!.subcriterios[si]!;
    const { [regiao]: _drop, ...resto } = s.regionalOptions ?? {};
    updSub(ci, si, { regionalOptions: resto });
  }

  // ── Condições de acesso ───────────────────────────────────────────────
  function addCond() {
    patch({
      accessConditions: [...v.accessConditions, { key: "", label: "" }],
    });
  }
  function updCond(i: number, p: Partial<AccessCondition>) {
    patch({
      accessConditions: v.accessConditions.map((c, idx) => {
        if (idx !== i) return c;
        const next = { ...c, ...p };
        // auto-slug da chave a partir da etiqueta enquanto não for editada à mão
        if (p.label !== undefined && (!c.key || c.key === slug(c.label)))
          next.key = slug(p.label);
        return next;
      }),
    });
  }
  function delCond(i: number) {
    patch({
      accessConditions: v.accessConditions.filter((_, idx) => idx !== i),
    });
  }

  // ── Importar do PDF ───────────────────────────────────────────────────
  async function importar() {
    setImportando(true);
    setErro(null);
    setNota(null);
    try {
      const p = await api.importarAviso(importUrl.trim());
      setV((cur) => ({
        ...cur,
        programCode: p.metadata.programCode || cur.programCode,
        measure: p.metadata.medida || cur.measure,
        codigoAviso: p.metadata.codigo_aviso || cur.codigoAviso,
        regiao: p.metadata.regiao,
        versao: p.metadata.versao || cur.versao,
        fonteUrl: p.metadata.fonte_url || importUrl.trim(),
        mpMinimo: p.metadata.mp_minimo,
        minimoPorCriterio: p.metadata.minimo_por_criterio,
        formulaMp: p.metadata.formula_mp,
        grid: p.grid,
        accessConditions: p.accessConditions,
        eligibilidade: p.eligibilidade,
        extracted: false, // proposta entra sempre como rascunho
      }));
      setNota(p.nota);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao importar do PDF.");
    } finally {
      setImportando(false);
    }
  }

  // ── JSON em bruto (caminho secundário para a grelha) ──────────────────
  function abrirJson() {
    setJsonTexto(JSON.stringify(grid, null, 2));
    setJsonErro(null);
    setJsonModo(true);
  }
  function aplicarJson() {
    try {
      const parsed = JSON.parse(jsonTexto) as unknown;
      const r = parseMeritGrid(parsed);
      if (!r.ok) {
        setJsonErro(r.error);
        return;
      }
      setV((cur) => ({
        ...cur,
        grid: r.data,
        measure: r.data.medida || cur.measure,
        codigoAviso: r.data.codigo_aviso || cur.codigoAviso,
        regiao: r.data.regiao,
        versao: r.data.versao || cur.versao,
        formulaMp: r.data.formula_mp,
        mpMinimo: r.data.mp_minimo,
        minimoPorCriterio: r.data.minimo_por_criterio,
      }));
      setJsonModo(false);
    } catch (e) {
      setJsonErro(e instanceof Error ? e.message : "JSON inválido.");
    }
  }

  // ── Guardar / publicar ────────────────────────────────────────────────
  async function guardar(publicar: boolean) {
    setBusy(true);
    setErro(null);
    const r = parseMeritGrid(grid);
    if (!r.ok) {
      setErro(`Corrija a grelha antes de guardar: ${r.error}`);
      setBusy(false);
      return;
    }
    const body: SaveAvisoBody = {
      programCode: v.programCode,
      measure: v.measure.trim(),
      codigoAviso: v.codigoAviso.trim(),
      regiao: v.regiao?.trim() || null,
      versao: v.versao.trim(),
      fonteUrl: v.fonteUrl.trim() || null,
      mpMinimo: v.mpMinimo,
      minimoPorCriterio: v.minimoPorCriterio,
      formulaMp: v.formulaMp.trim() || null,
      grid: r.data,
      accessConditions: v.accessConditions
        .map((c) => ({
          key: (c.key || slug(c.label)).trim(),
          label: c.label.trim(),
        }))
        .filter((c) => c.label),
      eligibilidade: v.eligibilidade,
      extracted: publicar ? true : v.extracted,
    };
    try {
      if (aviso) await api.updateAviso(aviso.id, body);
      else await api.createAviso(body);
      onSaved();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="detail-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: 920,
          width: "94vw",
          maxHeight: "92vh",
          overflow: "auto",
        }}
      >
        <div className="dp-title">{aviso ? "Editar aviso" : "Novo aviso"}</div>
        <p className="deadline-sub" style={{ marginTop: 0 }}>
          A IA propõe a partir do PDF; o admin revê, corrige e valida. Guardar
          mantém o aviso como rascunho (por publicar) — não fica visível aos
          consultores. "Publicar" torna-o disponível aos projetos.
        </p>

        {/* Importar do PDF */}
        <div
          className="card"
          style={{ background: "var(--surface-2, #fafafa)", marginBottom: 12 }}
        >
          <label className="login-label">Importar do PDF do aviso (URL)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="login-input"
              style={{ flex: 1, minWidth: 240 }}
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://portugal2030.pt/…/aviso.pdf"
            />
            <button
              className="btn btn-secondary"
              onClick={importar}
              disabled={importando || !importUrl.trim()}
            >
              {importando ? "A importar…" : "Importar do PDF"}
            </button>
          </div>
          {nota && (
            <p className="deadline-sub" style={{ marginTop: 6 }}>
              {nota}
            </p>
          )}
        </div>

        {/* Metadados */}
        <div
          className="grid-2"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label className="login-label">Programa</label>
            <Dropdown
              block
              value={v.programCode}
              onChange={(val) => patch({ programCode: val })}
              options={PROGRAM_CODES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label className="login-label">Código do aviso</label>
            <input
              className="login-input"
              value={v.codigoAviso}
              onChange={(e) => patch({ codigoAviso: e.target.value })}
              placeholder="MPr-2025-2"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">Medida</label>
            <input
              className="login-input"
              value={v.measure}
              onChange={(e) => patch({ measure: e.target.value })}
            />
          </div>
          <div>
            <label className="login-label">
              Região (opcional — para grelhas regionais)
            </label>
            <Dropdown
              block
              value={v.regiao ?? ""}
              allLabel="Sem região (nacional)"
              onChange={(val) => patch({ regiao: val || null })}
              options={NUTS2.map((n) => ({ value: n, label: n }))}
            />
          </div>
          <div>
            <label className="login-label">Versão</label>
            <input
              className="login-input"
              value={v.versao}
              onChange={(e) => patch({ versao: e.target.value })}
              placeholder="2025-03-10"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">Fonte (URL do PDF)</label>
            <input
              className="login-input"
              value={v.fonteUrl}
              onChange={(e) => patch({ fonteUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="login-label">MP mínimo</label>
            <input
              className="login-input"
              type="number"
              step="0.1"
              value={v.mpMinimo ?? ""}
              onChange={(e) =>
                patch({
                  mpMinimo:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label className="login-label">Mínimo por critério</label>
            <input
              className="login-input"
              type="number"
              step="0.1"
              value={v.minimoPorCriterio ?? ""}
              onChange={(e) =>
                patch({
                  minimoPorCriterio:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="login-label">
              Fórmula MP (ex.: 0.30*A + 0.30*B + 0.15*C + 0.25*D)
            </label>
            <input
              className="login-input"
              value={v.formulaMp}
              onChange={(e) => patch({ formulaMp: e.target.value })}
            />
          </div>
        </div>

        {/* Escala */}
        <div style={{ marginTop: 12 }}>
          <label className="login-label">
            Escala (mín / máx / descritores)
          </label>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <input
              className="login-input"
              style={{ width: 90 }}
              type="number"
              value={grid.escala.min}
              onChange={(e) =>
                patchGrid({
                  escala: { ...grid.escala, min: Number(e.target.value) },
                })
              }
            />
            <span className="deadline-sub">a</span>
            <input
              className="login-input"
              style={{ width: 90 }}
              type="number"
              value={grid.escala.max}
              onChange={(e) =>
                patchGrid({
                  escala: { ...grid.escala, max: Number(e.target.value) },
                })
              }
            />
          </div>
          <DescritoresEditor
            escala={grid.escala}
            onChange={(escala) => patchGrid({ escala })}
          />
        </div>

        {/* Condições de acesso */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Condições de acesso (§7.1)</strong>
            <button className="btn btn-secondary btn-sm" onClick={addCond}>
              + Condição
            </button>
          </div>
          {v.accessConditions.length === 0 && (
            <p className="deadline-sub">Sem condições. Adicione as do aviso.</p>
          )}
          {v.accessConditions.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                marginTop: 6,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <input
                className="login-input"
                style={{ flex: 2, minWidth: 200 }}
                value={c.label}
                onChange={(e) => updCond(i, { label: e.target.value })}
                placeholder="Etiqueta da condição"
              />
              <input
                className="login-input"
                style={{ flex: 1, minWidth: 140 }}
                value={c.key}
                onChange={(e) => updCond(i, { key: e.target.value })}
                placeholder="chave"
              />
              <button className="back-link" onClick={() => delCond(i)}>
                Remover
              </button>
            </div>
          ))}
        </div>

        {/* Grelha de mérito */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Grelha de mérito — critérios</strong>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={abrirJson}>
                JSON em bruto
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={addCriterio}
              >
                + Critério
              </button>
            </div>
          </div>
          {grid.criterios.map((c, ci) => (
            <CriterioEditor
              key={ci}
              c={c}
              onChange={(p) => updCriterio(ci, p)}
              onDelete={() => delCriterio(ci)}
              onAddSub={() => addSub(ci)}
              onUpdSub={(si, p) => updSub(ci, si, p)}
              onDelSub={(si) => delSub(ci, si)}
              onToggleRegional={(si) => toggleRegional(ci, si)}
              onSetOptions={(si, opts) => setOptions(ci, si, opts)}
              onSetRegionOptions={(si, regiao, opts) =>
                setRegionOptions(ci, si, regiao, opts)
              }
              onAddRegion={(si, regiao) => addRegion(ci, si, regiao)}
              onDelRegion={(si, regiao) => delRegion(ci, si, regiao)}
            />
          ))}
        </div>

        {/* Validação + preview */}
        <div
          className="card"
          style={{ marginTop: 16, background: "var(--surface-2, #fafafa)" }}
        >
          {validacao.ok ? (
            <span className="badge badge-green">Grelha válida</span>
          ) : (
            <span className="badge badge-danger">
              Grelha inválida: {validacao.error}
            </span>
          )}
          {validacao.ok && <MeritPreview grid={grid} />}
        </div>

        {erro && (
          <div className="login-error" style={{ marginTop: 10 }}>
            {erro}
          </div>
        )}

        <div
          className="dp-actions"
          style={{
            borderTop: "none",
            padding: "14px 0 0",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <span style={{ flex: 1 }} />
          <span
            className={
              "badge " + (v.extracted ? "badge-green" : "badge-warning")
            }
            style={{ alignSelf: "center" }}
          >
            {v.extracted ? "Publicado" : "Rascunho (por publicar)"}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => guardar(false)}
            disabled={busy}
          >
            {busy ? "A guardar…" : "Guardar rascunho"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => guardar(true)}
            disabled={busy}
          >
            {busy ? "A guardar…" : "Guardar e publicar"}
          </button>
        </div>

        {/* JSON modal */}
        {jsonModo && (
          <div
            className="detail-overlay"
            onClick={(e) => e.target === e.currentTarget && setJsonModo(false)}
          >
            <div
              className="modal-card"
              style={{ maxWidth: 720, width: "90vw" }}
            >
              <div className="dp-title">
                Grelha em JSON (validada pelo esquema)
              </div>
              <textarea
                className="login-input"
                rows={18}
                style={{ fontFamily: "monospace", fontSize: 12 }}
                value={jsonTexto}
                onChange={(e) => setJsonTexto(e.target.value)}
              />
              {jsonErro && (
                <div className="login-error" style={{ marginTop: 8 }}>
                  {jsonErro}
                </div>
              )}
              <div
                className="dp-actions"
                style={{ borderTop: "none", padding: "12px 0 0" }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setJsonModo(false)}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={aplicarJson}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DescritoresEditor({
  escala,
  onChange,
}: {
  escala: MeritGridData["escala"];
  onChange: (e: MeritGridData["escala"]) => void;
}) {
  const entries = Object.entries(escala.descritores);
  return (
    <div>
      {entries.map(([k, val], i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input
            className="login-input"
            style={{ width: 70 }}
            value={k}
            onChange={(e) => {
              const next = { ...escala.descritores };
              delete next[k];
              next[e.target.value] = val;
              onChange({ ...escala, descritores: next });
            }}
          />
          <input
            className="login-input"
            style={{ flex: 1 }}
            value={val}
            onChange={(e) =>
              onChange({
                ...escala,
                descritores: { ...escala.descritores, [k]: e.target.value },
              })
            }
          />
          <button
            className="back-link"
            onClick={() => {
              const next = { ...escala.descritores };
              delete next[k];
              onChange({ ...escala, descritores: next });
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() =>
          onChange({
            ...escala,
            descritores: { ...escala.descritores, "": "" },
          })
        }
      >
        + Descritor
      </button>
    </div>
  );
}

function CriterioEditor({
  c,
  onChange,
  onDelete,
  onAddSub,
  onUpdSub,
  onDelSub,
  onToggleRegional,
  onSetOptions,
  onSetRegionOptions,
  onAddRegion,
  onDelRegion,
}: {
  c: MeritCriterion;
  onChange: (p: Partial<MeritCriterion>) => void;
  onDelete: () => void;
  onAddSub: () => void;
  onUpdSub: (si: number, p: Partial<MeritSubcriterion>) => void;
  onDelSub: (si: number) => void;
  onToggleRegional: (si: number) => void;
  onSetOptions: (si: number, opts: MeritOption[]) => void;
  onSetRegionOptions: (si: number, regiao: string, opts: MeritOption[]) => void;
  onAddRegion: (si: number, regiao: string) => void;
  onDelRegion: (si: number, regiao: string) => void;
}) {
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="login-input"
          style={{ width: 70 }}
          value={c.codigo}
          onChange={(e) => onChange({ codigo: e.target.value })}
          placeholder="A"
        />
        <input
          className="login-input"
          style={{ flex: 1, minWidth: 160 }}
          value={c.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          placeholder="Nome do critério"
        />
        <input
          className="login-input"
          style={{ width: 90 }}
          type="number"
          step="0.01"
          value={c.peso}
          onChange={(e) => onChange({ peso: Number(e.target.value) })}
          placeholder="peso"
        />
        <button className="back-link" onClick={onDelete}>
          Remover
        </button>
      </div>
      <input
        className="login-input"
        style={{ marginTop: 6 }}
        value={c.formula ?? ""}
        onChange={(e) => onChange({ formula: e.target.value || undefined })}
        placeholder="Fórmula interna (opcional, ex.: 0.50*B.1 + 0.35*B.3)"
      />

      <div
        style={{
          marginLeft: 14,
          marginTop: 8,
          borderLeft: "2px solid var(--border, #eee)",
          paddingLeft: 12,
        }}
      >
        {c.subcriterios.map((s, si) => (
          <div key={si} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                className="login-input"
                style={{ width: 70 }}
                value={s.codigo}
                onChange={(e) => onUpdSub(si, { codigo: e.target.value })}
                placeholder="A.1"
              />
              <input
                className="login-input"
                style={{ flex: 1, minWidth: 140 }}
                value={s.nome}
                onChange={(e) => onUpdSub(si, { nome: e.target.value })}
                placeholder="Nome do subcritério"
              />
              <input
                className="login-input"
                style={{ width: 80 }}
                type="number"
                step="0.01"
                value={s.weight ?? ""}
                onChange={(e) =>
                  onUpdSub(si, {
                    weight:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
                placeholder="peso"
              />
              <label
                className="deadline-sub"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <input
                  type="checkbox"
                  checked={!!s.regionalOptions}
                  onChange={() => onToggleRegional(si)}
                />{" "}
                regional
              </label>
              <button className="back-link" onClick={() => onDelSub(si)}>
                Remover sub
              </button>
            </div>

            {!s.regionalOptions && (
              <OptionsEditor
                opts={s.options ?? []}
                onChange={(opts) => onSetOptions(si, opts)}
              />
            )}
            {s.regionalOptions && (
              <RegionalEditor
                regional={s.regionalOptions}
                onSetRegion={(regiao, opts) =>
                  onSetRegionOptions(si, regiao, opts)
                }
                onAddRegion={(regiao) => onAddRegion(si, regiao)}
                onDelRegion={(regiao) => onDelRegion(si, regiao)}
              />
            )}
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={onAddSub}>
          + Subcritério
        </button>
      </div>
    </div>
  );
}

function OptionsEditor({
  opts,
  onChange,
}: {
  opts: MeritOption[];
  onChange: (o: MeritOption[]) => void;
}) {
  return (
    <div style={{ marginTop: 6, marginLeft: 8 }}>
      {opts.map((o, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}
        >
          <input
            className="login-input"
            style={{ flex: 2, minWidth: 140 }}
            value={o.label}
            onChange={(e) =>
              onChange(
                opts.map((x, idx) =>
                  idx === i ? { ...x, label: e.target.value } : x,
                ),
              )
            }
            placeholder="Etiqueta da opção"
          />
          <input
            className="login-input"
            style={{ width: 70 }}
            type="number"
            step="0.1"
            value={o.pts}
            onChange={(e) =>
              onChange(
                opts.map((x, idx) =>
                  idx === i ? { ...x, pts: Number(e.target.value) } : x,
                ),
              )
            }
            placeholder="pts"
          />
          <input
            className="login-input"
            style={{ flex: 1, minWidth: 100 }}
            value={o.note ?? ""}
            onChange={(e) =>
              onChange(
                opts.map((x, idx) =>
                  idx === i ? { ...x, note: e.target.value || undefined } : x,
                ),
              )
            }
            placeholder="nota (opc.)"
          />
          <button
            className="back-link"
            onClick={() => onChange(opts.filter((_, idx) => idx !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onChange([...opts, { label: "", pts: 1 }])}
      >
        + Opção
      </button>
    </div>
  );
}

function RegionalEditor({
  regional,
  onSetRegion,
  onAddRegion,
  onDelRegion,
}: {
  regional: Record<string, MeritOption[]>;
  onSetRegion: (regiao: string, opts: MeritOption[]) => void;
  onAddRegion: (regiao: string) => void;
  onDelRegion: (regiao: string) => void;
}) {
  const [novaRegiao, setNovaRegiao] = useState("");
  return (
    <div style={{ marginTop: 6, marginLeft: 8 }}>
      {Object.entries(regional).map(([regiao, opts]) => (
        <div
          key={regiao}
          style={{
            marginBottom: 8,
            borderTop: "1px dashed var(--border,#eee)",
            paddingTop: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong className="deadline-sub">{regiao}</strong>
            <button className="back-link" onClick={() => onDelRegion(regiao)}>
              Remover região
            </button>
          </div>
          <OptionsEditor opts={opts} onChange={(o) => onSetRegion(regiao, o)} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <Dropdown
          value={novaRegiao}
          placeholder="Adicionar região…"
          onChange={(val) => setNovaRegiao(val)}
          options={NUTS2.map((n) => ({ value: n, label: n }))}
        />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (novaRegiao) {
              onAddRegion(novaRegiao);
              setNovaRegiao("");
            }
          }}
        >
          + Região
        </button>
      </div>
    </div>
  );
}

/** Pré-visualização: escolher uma opção por subcritério e ver a MP resultante. */
function MeritPreview({ grid }: { grid: MeritGridData }) {
  const regioes = gridRegions(grid);
  const [regiao, setRegiao] = useState<string | null>(
    grid.regiao ?? regioes[0] ?? null,
  );
  const [sel, setSel] = useState<MeritSelection>({});

  const result = useMemo(
    () => computeMerit(grid, sel, regiao),
    [grid, sel, regiao],
  );

  function optsDe(s: MeritSubcriterion): MeritOption[] {
    if (s.regionalOptions) return (regiao && s.regionalOptions[regiao]) || [];
    return s.options ?? [];
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="deadline-sub" style={{ marginTop: 0 }}>
        Pré-visualização: escolha opções para validar o cálculo da MP.
      </p>
      {regioes.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label className="login-label">Região (matriz regional)</label>
          <Dropdown
            value={regiao ?? ""}
            placeholder="Escolher região…"
            onChange={(val) => setRegiao(val || null)}
            options={regioes.map((r) => ({ value: r, label: r }))}
          />
        </div>
      )}
      {grid.criterios.map((c) => (
        <div key={c.codigo} style={{ marginBottom: 6 }}>
          <strong className="deadline-sub">
            {c.codigo} — {c.nome}
          </strong>
          {c.subcriterios.map((s) => {
            const opts = optsDe(s);
            return (
              <div
                key={s.codigo}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <span className="deadline-sub" style={{ width: 60 }}>
                  {s.codigo}
                </span>
                <Dropdown
                  value={
                    sel[s.codigo] !== undefined ? String(sel[s.codigo]) : ""
                  }
                  placeholder={opts.length ? "Escolher…" : "(sem opções)"}
                  onChange={(val) =>
                    setSel((cur) => ({ ...cur, [s.codigo]: Number(val) }))
                  }
                  options={opts.map((o, idx) => ({
                    value: String(idx),
                    label: `${o.label} (${o.pts})`,
                  }))}
                />
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span className="badge badge-blue">MP: {result.mp.toFixed(2)}</span>
        {result.criteria.map((cr) => (
          <span
            key={cr.codigo}
            className={
              "badge " + (cr.belowMinimum ? "badge-danger" : "badge-muted")
            }
          >
            {cr.codigo}: {cr.score.toFixed(2)}
          </span>
        ))}
        {result.missing.length === 0 && (
          <span
            className={
              "badge " + (result.passes ? "badge-green" : "badge-warning")
            }
          >
            {result.passes ? "Passa" : "Não passa o mínimo"}
          </span>
        )}
      </div>
    </div>
  );
}
