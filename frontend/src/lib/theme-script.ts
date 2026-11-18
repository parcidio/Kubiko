/**
 * Constantes e script do tema, sem React: o layout raiz (server component) importa daqui o THEME_SCRIPT.
 * Hooks e setTheme() em lib/theme.ts.
 */
export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "beeznoo.theme";
export const THEME_EVENT = "beeznoo:theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Omissão para quem nunca escolheu: claro (a identidade da marca é areia; o escuro é opção). */
export const DEFAULT_THEME: ThemePref = "light";

/** Script inline (sem dependências) — mantém a lógica igual à de setTheme() em lib/theme.ts. */
export const THEME_SCRIPT = `(function(){var K=${JSON.stringify(THEME_KEY)},D=${JSON.stringify(DEFAULT_THEME)},d=document.documentElement,m=window.matchMedia?matchMedia(${JSON.stringify(DARK_QUERY)}):null;function p(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"||v==="system"?v:D}catch(e){return D}}function a(){var v=p(),k=v==="dark"||(v==="system"&&!!m&&m.matches);d.classList.toggle("dark",k);d.style.colorScheme=k?"dark":"light"}a();if(m&&m.addEventListener)m.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===K||e.key===null)a()});window.addEventListener(${JSON.stringify(THEME_EVENT)},a)})()`;

