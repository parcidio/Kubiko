"use client";

import { useSyncExternalStore } from "react";
import { notificationApi } from "./api";
import { readSession } from "./session";

/**
 * Contagem de avisos por ler, partilhada entre o sino do topo e a navegação de baixo.
 * Polling a cada 60 s só com a aba visível e sessão iniciada (sem WebSocket — decisoes-produto.md 2026-10-23).
 * Quem marca avisos como lidos chama refreshUnread() para o sino acompanhar logo.
 */
const POLL_MS = 60_000;

let unread = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function refreshUnread() {
  if (!readSession()) {
    if (unread !== 0) {
      unread = 0;
      emit();
    }
    return;
  }
  try {
    const { unread: n } = await notificationApi.unreadCount();
    if (n !== unread) {
      unread = n;
      emit();
    }
  } catch {
    /* rede fraca: fica a contagem anterior e tenta na próxima volta */
  }
}

function onVisible() {
  if (document.visibilityState === "visible") refreshUnread();
}

function start() {
  refreshUnread();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") refreshUnread();
  }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("beeznoo:session", refreshUnread);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("beeznoo:session", refreshUnread);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => unread, () => 0);
}

/** Só caminhos internos (o linkPath vem da API, mas não se segue nada para fora da app). */
export function safeLink(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  return path;
}
