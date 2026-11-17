import type { Lang } from "./i18n";
import type { ItemCondition } from "./types";

// Kz é igual nas duas línguas ("25.000 Kz"). Datas: pt à mão ("16 a 18 out"), en com Intl en-GB ("16–18 Oct").

// 25000 → "25.000 Kz"
export function formatKz(value: number | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString("de-DE")} Kz`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parse(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const EN_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const EN_WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const EN_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

// "2026-10-16","2026-10-18" → "16 a 18 out" · en: "16–18 Oct"
export function formatRange(start: string, end: string, lang: Lang = "pt") {
  const a = parse(start);
  const b = parse(end);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (lang === "en") return sameMonth ? `${a.getDate()}–${EN_DAY.format(b)}` : `${EN_DAY.format(a)} – ${EN_DAY.format(b)}`;
  return sameMonth
    ? `${a.getDate()} a ${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} a ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** Dias inclusivos: "16 out" (um dia) ou "16 a 18 out". */
export function formatDays(start: string, end: string, lang: Lang = "pt") {
  return start === end ? formatDay(start, false, lang) : formatRange(start, end, lang);
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

/** "8%" (sem casas decimais quando a taxa é redonda, "7,5%" quando não é; en: "7.5%"). */
export function formatFeeRate(rate: number, lang: Lang = "pt") {
  return `${(rate * 100).toLocaleString(lang === "en" ? "en-GB" : "pt-PT", { maximumFractionDigits: 1 })}%`;
}

/** Exemplo de preço da landing (3 diárias × 35.000 Kz + taxa + caução de 105.000 Kz), com a taxa em vigor. */
export function landingExample(rate: number, lang: Lang = "pt") {
  const rental = 3 * 35_000;
  const fee = Math.round(rental * rate);
  const deposit = 105_000;
  return { rental, fee, deposit, total: rental + fee + deposit, rateLabel: formatFeeRate(rate, lang) };
}

/** Etiquetas em português (admin e formulário). Nos ecrãs traduzidos usa t.condition[...]. */
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

// "2026-10-16" → "16 out" · com weekday: "sex, 16 out" · en: "16 Oct" / "Fri 16 Oct"
export function formatDay(iso: string, weekday = false, lang: Lang = "pt") {
  const d = parse(iso);
  if (lang === "en") return (weekday ? EN_WEEKDAY : EN_DAY).format(d);
  const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${weekday ? `${wd}, ` : ""}${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// instante → "16 out, 14:00" · en: "16 Oct, 14:00"
export function formatDateTime(value: string | Date, lang: Lang = "pt") {
  const d = new Date(value);
  if (lang === "en") return `${EN_DAY.format(d)}, ${EN_TIME.format(d)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ms restantes → "9 h 12 min" · "45 min" · en: "2 days"
export function formatDuration(ms: number, lang: Lang = "pt") {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d} ${lang === "en" ? "days" : "dias"}`;
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
