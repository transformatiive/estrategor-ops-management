import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Dropdown próprio (nunca o `<select>` nativo do browser): botão + menu
 * flutuante, fecha ao clicar fora ou em Escape. Usado em filtros (com `allLabel`,
 * que limpa para "") e em formulários (com `placeholder` e `block`).
 */
export function Dropdown({
  value,
  options,
  onChange,
  allLabel,
  placeholder,
  block,
  style,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  /** filtros: rótulo do item "todos" que limpa a seleção (value === "") */
  allLabel?: string;
  /** formulários: texto quando nada está selecionado */
  placeholder?: string;
  /** ocupa a largura toda (campo de formulário) */
  block?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const label = current ? current.label : allLabel ?? placeholder ?? "—";

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className={"dropdown" + (block ? " block" : "")} ref={ref} style={style}>
      <button type="button" className={"dropdown-btn" + (value ? " filled" : "")} onClick={() => setOpen((o) => !o)}>
        <span className="dropdown-label">{label}</span>
        <span className="dropdown-caret">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox">
          {allLabel && (
            <button type="button" className={"dropdown-item" + (value === "" ? " sel" : "")} onClick={() => pick("")}>
              {allLabel}
            </button>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={"dropdown-item" + (o.value === value ? " sel" : "")}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
          {options.length === 0 && <div className="gsearch-empty">Sem opções.</div>}
        </div>
      )}
    </div>
  );
}
