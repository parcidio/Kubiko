import type { BookingStatus, ItemCondition } from "./types";

// 25000 → "25.000 Kz"
export function formatKz(value: number | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString("de-DE")} Kz`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "2026-10-16","2026-10-18" → "16 a 18 out"
export function formatRange(start: string, end: string) {
  const a = parse(start);
  const b = parse(end);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth
    ? `${a.getDate()} a ${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} a ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000));
}

export function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const SERVICE_FEE_RATE = 0.08;

export const CONDITION_LABEL: Record<ItemCondition, string> = {
  NEW: "Novo",
  LIKE_NEW: "Como novo",
  GOOD: "Bom estado",
  FAIR: "Sinais de uso",
};

export const BOOKING_STATUS: Record<
  BookingStatus,
  { label: string; badge: "pendente" | "analise" | "ok" | "erro" | "neutro" | "escuro" }
> = {
  PENDING_OWNER: { label: "À espera do dono", badge: "pendente" },
  ACCEPTED: { label: "Aceite · por pagar", badge: "pendente" },
  ACTIVE: { label: "Pago · em curso", badge: "ok" },
  COMPLETED: { label: "Concluída", badge: "neutro" },
  CANCELLED_RENTER: { label: "Cancelada por ti", badge: "neutro" },
  CANCELLED_OWNER: { label: "Recusada pelo dono", badge: "erro" },
  DISPUTED: { label: "Problema reportado", badge: "erro" },
};

export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING_OWNER", "ACCEPTED", "ACTIVE", "DISPUTED"];

// "+244 923 456 789" / "923456789" → "+244923456789"
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "").replace(/^244/, "");
  return `+244${digits}`;
}

export function isValidPhone(input: string) {
  return /^\+2449\d{8}$/.test(normalizePhone(input));
}
