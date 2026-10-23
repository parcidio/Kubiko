"use client";

import { useSyncExternalStore } from "react";
import type { UserRole } from "./types";

// Um utilizador pode alugar e ser dono. O "modo" só muda a navegação — não é uma permissão.
export type Mode = "renter" | "owner";

const KEY = "beeznoo.mode";

export const canRent = (role?: UserRole) => role === "RENTER" || role === "BOTH";
export const canOwn = (role?: UserRole) => role === "OWNER" || role === "BOTH";
export const isAdmin = (role?: UserRole) => role === "ADMIN";

function read(): Mode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "owner" || v === "renter" ? v : null;
  } catch {
    return null;
  }
}

export function setMode(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* sem storage: fica só nesta página */
  }
  window.dispatchEvent(new Event("beeznoo:mode"));
}

function subscribe(cb: () => void) {
  window.addEventListener("beeznoo:mode", cb);
  return () => window.removeEventListener("beeznoo:mode", cb);
}

/** Modo atual, com o papel a decidir o valor por omissão. */
export function useMode(role?: UserRole): Mode {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  if (role === "OWNER") return "owner";
  if (role === "RENTER") return "renter";
  return stored ?? "renter";
}
