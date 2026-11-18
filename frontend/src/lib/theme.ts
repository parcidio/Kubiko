"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, DEFAULT_THEME, THEME_EVENT, THEME_KEY, type ThemePref } from "./theme-script";

/**
 * Tema (claro / escuro / sistema) — um só mecanismo para landing, autenticação, app e admin.
 *
 * - A escolha vive em localStorage (`beeznoo.theme`): é uma preferência do aparelho, não da conta, por isso
 *   continua igual depois de sair da sessão.
 * - THEME_SCRIPT corre no <head> do layout raiz, antes da primeira pintura: põe (ou tira) a classe `.dark` no
 *   <html> e o `color-scheme`. Sem flash e sem depender de que um layout em particular esteja montado.
 * - O mesmo script segue o sistema operativo quando a escolha é "sistema" e sincroniza outros separadores.
 * - Os componentes usam useThemePref()/useResolvedTheme(); setTheme() grava, aplica e avisa os outros componentes (evento beeznoo:theme).
 */
export type { ThemePref };

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function systemDark() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
}

/** Grava a escolha e aplica-a já (o script do <head> também ouve o evento, mas aqui não esperamos por ele). */
export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* sem storage: aplica só nesta página */
  }
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia?.(DARK_QUERY);
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  mq?.addEventListener?.("change", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
    mq?.removeEventListener?.("change", cb);
  };
}

/** Escolha guardada (no servidor e na hidratação: a omissão). */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => DEFAULT_THEME);
}

/** Tema efetivo neste momento: lido da classe no <html>, que é a fonte de verdade depois do script. */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
}
