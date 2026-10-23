import type { ItemCondition } from "./types";

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

// "+244 923 456 789" / "923456789" → "+244923456789"
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "").replace(/^244/, "");
  return `+244${digits}`;
}

export function isValidPhone(input: string) {
  return /^\+2449\d{8}$/.test(normalizePhone(input));
}

// "2026-10-16" → "16 out" · com weekday: "sex, 16 out"
export function formatDay(iso: string, weekday = false) {
  const d = parse(iso);
  const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${weekday ? `${wd}, ` : ""}${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// instante → "16 out, 14:00"
export function formatDateTime(value: string | Date) {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ms restantes → "9 h 12 min" · "45 min"
export function formatDuration(ms: number) {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d} dias`;
  if (h > 0) return `${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
  return `${min} min`;
}

/** Caução sugerida (SPEC §5, regra [EM ABERTO]): o menor entre 10% do valor do equipamento e 3 diárias. */
export function suggestedDeposit(declaredValue: number, pricePerDay: number) {
  if (!declaredValue || !pricePerDay) return 0;
  return Math.round(Math.min(declaredValue * 0.1, pricePerDay * 3));
}

export const LUANDA_AREAS = [
  "Talatona", "Kilamba", "Maianga", "Ingombota", "Viana", "Benfica", "Miramar", "Alvalade", "Cazenga", "Camama", "Sambizanga", "Rangel",
];

// "2026-10-16", 2 → "2026-10-18"
export function addDaysIso(iso: string, n: number) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
