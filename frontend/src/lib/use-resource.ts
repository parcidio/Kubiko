"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { docT } from "./i18n";

type Result<T> = { key: string; data?: T; error?: string };

/**
 * Carrega dados para uma chave. Muda a chave (ou chama reload) → volta a "a carregar".
 * key = null → não carrega (ex.: à espera da sessão).
 * `keepPrevious`: enquanto a chave nova carrega, continua a devolver os dados da anterior (`stale: true`), em vez de
 * voltar ao skeleton. Útil em listas filtradas (Explorar): menos saltos de layout e cartões que não voltam a animar.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>, options?: { keepPrevious?: boolean }) {
  const [nonce, setNonce] = useState(0);
  const fullKey = key === null ? null : `${key}#${nonce}`;
  const [result, setResult] = useState<Result<T> | null>(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (fullKey === null) return;
    let alive = true;
    fetcherRef.current().then(
      (data) => alive && setResult({ key: fullKey, data }),
      (e) => alive && setResult({ key: fullKey, error: e instanceof Error ? e.message : docT().common.somethingWrong }),
    );
    return () => {
      alive = false;
    };
  }, [fullKey]);

  const current = result && result.key === fullKey ? result : null;
  const previous = !current && options?.keepPrevious && result?.data !== undefined ? result : null;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => fullKey && setResult({ key: fullKey, data }), [fullKey]);

  return { data: current?.data ?? previous?.data, error: current?.error, loading: !current, stale: !!previous, reload, setData };
}
