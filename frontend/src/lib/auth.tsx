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

export async function signOut() {
  try {
    await authApi.logout();
  } catch {
    /* sessão local é limpa na mesma */
  }
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

/** Só aceita caminhos internos, para evitar open redirect via ?next=. */
export function safeNext(next: string | null, fallback = "/explorar") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
