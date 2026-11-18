/**
 * Telefones em E.164 (decisoes-produto.md 2026-11-17, decisão 3): Angola (+244) por omissão, mas qualquer país é
 * aceite — quem está em Luanda com um número estrangeiro também se regista. Fora de +244 o código vai só por WhatsApp.
 * Tem de bater certo com AuthDtos.PHONE no backend: ^(\+244[0-9]{9}|\+(?!244)[1-9][0-9]{7,14})$
 */

export interface PhoneCountry {
  /** ISO 3166-1 alfa-2 (o nome vem de Intl.DisplayNames na língua da página). */
  iso: string;
  dial: string;
  /** Dígitos do número nacional (sem indicativo nem 0 inicial). */
  min: number;
  max: number;
  placeholder: string;
}

export const DEFAULT_DIAL = "+244";

// Angola primeiro; depois os países de onde mais vem quem está em Luanda (lusófonos, vizinhos, expatriados)
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "AO", dial: "+244", min: 9, max: 9, placeholder: "923 456 789" },
  { iso: "PT", dial: "+351", min: 9, max: 9, placeholder: "912 345 678" },
  { iso: "BR", dial: "+55", min: 10, max: 11, placeholder: "11 91234 5678" },
  { iso: "MZ", dial: "+258", min: 8, max: 9, placeholder: "82 123 4567" },
  { iso: "CV", dial: "+238", min: 7, max: 7, placeholder: "991 23 45" },
  { iso: "ST", dial: "+239", min: 7, max: 7, placeholder: "981 2345" },
  { iso: "GW", dial: "+245", min: 7, max: 9, placeholder: "955 012 345" },
  { iso: "ZA", dial: "+27", min: 9, max: 9, placeholder: "71 234 5678" },
  { iso: "NA", dial: "+264", min: 8, max: 9, placeholder: "81 123 4567" },
  { iso: "CD", dial: "+243", min: 9, max: 9, placeholder: "991 234 567" },
  { iso: "CG", dial: "+242", min: 9, max: 9, placeholder: "06 123 4567" },
  { iso: "ZM", dial: "+260", min: 9, max: 9, placeholder: "95 512 3456" },
  { iso: "NG", dial: "+234", min: 10, max: 10, placeholder: "802 123 4567" },
  { iso: "FR", dial: "+33", min: 9, max: 9, placeholder: "6 12 34 56 78" },
  { iso: "ES", dial: "+34", min: 9, max: 9, placeholder: "612 34 56 78" },
  { iso: "GB", dial: "+44", min: 10, max: 10, placeholder: "7400 123456" },
  { iso: "DE", dial: "+49", min: 7, max: 12, placeholder: "1512 3456789" },
  { iso: "IT", dial: "+39", min: 6, max: 11, placeholder: "312 345 6789" },
  { iso: "US", dial: "+1", min: 10, max: 10, placeholder: "201 555 0123" },
  { iso: "CN", dial: "+86", min: 11, max: 11, placeholder: "131 2345 6789" },
  { iso: "AE", dial: "+971", min: 8, max: 9, placeholder: "50 123 4567" },
];

const BY_DIAL_DESC = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
const E164 = /^(\+244[0-9]{9}|\+(?!244)[1-9][0-9]{7,14})$/;

/** País pelo indicativo (o mais longo que encaixa). */
export function countryOf(e164: string): PhoneCountry | undefined {
  return BY_DIAL_DESC.find((c) => e164.startsWith(c.dial));
}

/** Junta indicativo + número nacional no valor do campo ("+351 912345678"). */
export function joinPhone(dial: string, national: string) {
  return `${dial} ${national}`;
}

/** "+351 912 345 678" → { dial: "+351", national: "912 345 678" }. Sem "+": número angolano antigo. */
export function splitPhone(value: string): { dial: string; national: string; known: boolean } {
  const v = value.trimStart();
  if (!v.startsWith("+")) return { dial: DEFAULT_DIAL, national: v, known: true };
  const space = v.indexOf(" ");
  const head = space === -1 ? v : v.slice(0, space);
  const c = PHONE_COUNTRIES.find((p) => p.dial === head);
  if (c) return { dial: c.dial, national: space === -1 ? "" : v.slice(space + 1), known: true };
  return { dial: "", national: v, known: false };
}

/**
 * Normaliza para E.164. Aceita "923 456 789" (Angola), "+244 923…", "00351 912…", "+44 07400…" (tira o 0 de
 * acesso nacional, exceto Itália). Não inventa: o que não se percebe fica como está e a validação recusa.
 */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (/[^\d\s+().-]/.test(raw)) return raw;
  let digits = raw.replace(/\D/g, "");
  let intl = raw.startsWith("+");
  if (!intl && digits.startsWith("00")) {
    digits = digits.slice(2);
    intl = true;
  }
  if (!intl) {
    // número nacional angolano, com ou sem 244 à frente
    if (digits.length === 12 && digits.startsWith("244")) return `+${digits}`;
    return `+244${digits}`;
  }
  const full = `+${digits}`;
  const c = countryOf(full);
  if (c && c.dial !== "+39") {
    const national = full.slice(c.dial.length);
    if (national.startsWith("0")) return c.dial + national.slice(1);
  }
  return full;
}

export function isForeignPhone(input: string) {
  const n = normalizePhone(input);
  return n.startsWith("+") && !n.startsWith(DEFAULT_DIAL);
}

/** Valida pelo país quando o conhecemos; senão, E.164 genérico (8–15 dígitos), como o backend. */
export function isValidPhone(input: string) {
  const n = normalizePhone(input);
  if (!E164.test(n)) return false;
  if (n.startsWith("+244")) return /^\+2449\d{8}$/.test(n);
  const c = countryOf(n);
  if (!c) return true;
  const len = n.length - c.dial.length;
  return len >= c.min && len <= c.max;
}
