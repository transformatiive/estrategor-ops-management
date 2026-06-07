import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Hook simples de carregamento de dados com estados loading/erro/repetir. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const runRef = useRef(run);

  useEffect(() => {
    let active = true;
    // Um refresh (reload por `nonce`) mantém os dados atuais visíveis para não
    // desmontar a UI nem perder o contexto (secções abertas, scroll, edição em
    // curso). Só mostramos "loading" no primeiro carregamento ou quando as
    // dependências mudam — ex.: mudar de projeto (TRNSF-1055).
    const depsChanged = runRef.current !== run;
    runRef.current = run;
    if (depsChanged) setLoading(true);
    setError(null);
    run()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [run, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
