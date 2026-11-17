import { en } from "./en";
import { pt, type Dict } from "./pt";

/**
 * i18n próprio, sem biblioteca (decisoes-produto.md 2026-11-17, ponto 7). Ver docs/I18N.md.
 * pt.ts é a fonte; en.ts tem o mesmo tipo (Dict), por isso uma chave em falta parte o typecheck.
 */
export type { Dict };
export type Lang = "pt" | "en";

export const LANGS: readonly Lang[] = ["pt", "en"];
export const DEFAULT_LANG: Lang = "pt";
export const LANG_COOKIE = "lang";

/** Locale para Intl (datas, números que não são Kz) e para <html lang>. */
export const LOCALE: Record<Lang, string> = { pt: "pt-PT", en: "en-GB" };

const DICTS: Record<Lang, Dict> = { pt, en };

export function isLang(value: unknown): value is Lang {
  return value === "pt" || value === "en";
}

export function toLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

export function getDict(lang: Lang): Dict {
  return DICTS[lang];
}

/**
 * Língua fora de componentes (toasts, toFormErrors, handlers): lê <html lang> no browser; no servidor dá "pt".
 * Em componentes usa useT()/useLang() (cliente) ou getT() (servidor).
 */
export function docLang(): Lang {
  return typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en" : DEFAULT_LANG;
}

export function docT(): Dict {
  return getDict(docLang());
}

/** Interpolação: fmt("Olá, {name}", { name: "Ana" }) → "Olá, Ana". Chaves sem valor ficam como estão. */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Singular/plural: plural(2, { one: "{n} dia", other: "{n} dias" }) → "2 dias". */
export function plural(n: number, forms: { one: string; other: string }, vars: Record<string, string | number> = {}) {
  return fmt(n === 1 ? forms.one : forms.other, { n, ...vars });
}
