"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, LANG_COOKIE, type Dict, type Lang } from "./index";

const LangContext = createContext<Lang>("pt");

/** Fornecido no layout raiz com a língua lida do cookie no servidor. */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Dicionário da língua atual: const t = useT(); t.common.retry */
export function useT(): Dict {
  return getDict(useLang());
}

/** Muda a língua: grava o cookie (1 ano) e pede a árvore outra vez ao servidor (server components incluídos). */
export function useSetLang() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setLang = (lang: Lang) => {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };
  return { setLang, pending };
}
