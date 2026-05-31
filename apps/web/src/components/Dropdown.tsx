import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Dropdown próprio (não o `<select>` nativo do browser): botão + menu flutuante,
 * fecha ao clicar fora ou em Escape. Usado nos filtros de projetos.
 */
export function Dropdown({
  value,
  options,
  onChange,
  allLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  /** rótulo quando nada está selecionado (value === "") */
  allLabel: string;
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
  const label = value === "" ? allLabel : current?.label ?? allLabel;

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={"dropdown-btn" + (value ? " filled" : "")} onClick={() => setOpen((o) => !o)}>
        <span className="dropdown-label">{label}</span>
        <span className="dropdown-caret">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox">
          <button type="button" className={"dropdown-item" + (value === "" ? " sel" : "")} onClick={() => pick("")}>
            {allLabel}
          </button>
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
        </div>
      )}
    </div>
  );
}
