"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "./api";
import { readSession, toSession, writeSession, type Session } from "./session";
import type { AuthResponse } from "./types";

let cachedRaw: string | null = null;
let cached: Session | null = null;

function subscribe(cb: () => void) {
  window.addEventListener("beeznoo:session", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("beeznoo:session", cb);
    window.removeEventListener("storage", cb);
  };
}

function snapshot() {
  const s = readSession();
  const raw = s ? s.accessToken : null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = s;
  }
  return cached;
}

/** undefined = ainda a ler (SSR/hidratação); null = sem sessão. */
export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

export function signIn(res: AuthResponse) {
  writeSession(toSession(res));
}

/** Prefixo dos rascunhos de "Publicar" (um por conta). Apagados ao sair: o telemóvel pode ser partilhado. */
export const DRAFT_KEY_PREFIX = "beeznoo.publicar.rascunho";

function clearDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DRAFT_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* sem storage */
  }
}

export async function signOut() {
  try {
    await authApi.logout();
  } catch {
    /* sessão local é limpa na mesma */
  }
  clearDrafts();
  writeSession(null);
}

/** Redireciona para /entrar se não houver sessão, voltando depois para a página atual. */
export function useRequireSession() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session === null) router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
  }, [session, router, pathname]);
  return session;
}

const NEXT_BASE = "https://beeznoo.invalid";

/**
 * Só aceita caminhos internos, para evitar open redirect via ?next=. Recusa "//x", "/\\x", caracteres de controlo e
 * barras codificadas (%2f, %5c); depois resolve o caminho e exige a mesma origem.
 */
export function safeNext(next: string | null, fallback = "/explorar") {
  if (!next || next.length > 2048) return fallback;
  if (!/^\/(?![/\\])/.test(next)) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next) || /%(2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(next)) return fallback;
  try {
    const url = new URL(next, NEXT_BASE);
    if (url.origin !== NEXT_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
