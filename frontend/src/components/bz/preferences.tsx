"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/client";
import { setTheme, useResolvedTheme, useThemePref, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { LangSwitch } from "./lang-switch";

/** Largura do painel (cabe o seletor de tema com texto); no telemóvel encolhe até ao ecrã menos 16px. */
const PANEL_WIDTH = 312;

const THEME_OPTIONS: { value: ThemePref; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/**
 * Tema claro / escuro / sistema (SegmentedControl, v4 §8). Radiogroup com setas, alvos de 44px.
 * `dark` = sobre fundos verdes da marca. `iconsOnly` = sem texto (o nome fica no aria-label de cada opção).
 */
export function ThemeSwitch({ dark, iconsOnly, className }: { dark?: boolean; iconsOnly?: boolean; className?: string }) {
  const pref = useThemePref();
  const t = useT().common;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Setas mudam a escolha e o foco (padrão de radiogroup); Tab entra e sai do grupo de uma vez
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    setTheme(THEME_OPTIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.theme}
      className={cn("inline-grid grid-cols-3 gap-1 rounded-[14px] p-1", dark ? "bg-white/10" : "bg-areia-2", className)}
    >
      {THEME_OPTIONS.map(({ value, icon: Icon }, i) => {
        const on = pref === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={iconsOnly ? t.themes[value] : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => setTheme(value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-campo px-3 text-sm font-bold transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar",
              on
                ? dark ? "bg-areia text-verde" : "bg-verde text-areia"
                : dark ? "text-salvia-tint hover:bg-white/10 hover:text-white" : "text-verde hover:bg-skeleton",
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {!iconsOnly && <span>{t.themes[value]}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Botão compacto "tema e língua" para cabeçalhos (landing, app, admin, autenticação): ícone do tema efetivo + código
 * da língua. Abre um painel com ThemeSwitch e LangSwitch.
 * O painel vai para o <body> (portal) para usar sempre as cores do tema da página, mesmo quando o botão está num
 * bloco verde da marca (que fixa as cores claras). Ao abrir, o foco entra no painel; fecha com Escape (o foco volta
 * ao botão), clique fora, Tab para fora, scroll ou mudança de tamanho.
 * `dark` = botão sobre fundos verdes. `align` = de que lado o painel abre em relação ao botão.
 */
export function PreferencesMenu({ dark, align = "end", className }: { dark?: boolean; align?: "start" | "end"; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const open = pos !== null;
  const resolved = useResolvedTheme();
  const lang = useLang();
  const t = useT().common;
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) return setPos(null);
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    // Alinhado ao lado pedido do botão, mas sempre dentro do ecrã (margem de 8px)
    const vw = window.innerWidth;
    const width = Math.min(PANEL_WIDTH, vw - 16);
    const wanted = align === "start" ? r.left : r.right - width;
    setPos({ top: r.bottom + 8, left: Math.min(Math.max(8, wanted), vw - width - 8), width });
  };

  useEffect(() => {
    if (!open) return;
    // Foco na opção de tema escolhida (o painel está no fim do <body>, fora da ordem de Tab do cabeçalho)
    panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setPos(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPos(null);
      button.current?.focus();
    };
    const onMove = () => setPos(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, [open]);

  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t.preferencesLabel}
        title={t.preferences}
        onClick={toggle}
        className={cn(
          "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 font-corpo text-[13px] font-bold tracking-[0.06em] transition-colors duration-200",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar",
          dark
            ? cn("text-salvia-tint hover:bg-white/10 hover:text-white", open && "bg-white/10 text-white")
            : cn("text-verde hover:bg-areia-2", open && "bg-areia-2"),
          className,
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
        <span aria-hidden className="uppercase">{lang}</span>
      </button>
      {pos &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={t.preferences}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && !panel.current?.contains(next) && next !== button.current) setPos(null);
            }}
            className="fixed z-[90] grid animate-aparece gap-3 rounded-sheet border border-borda bg-branco p-3 text-left font-corpo text-[15px] text-verde shadow-sheet"
          >
            <div className="grid gap-1.5">
              <p className="px-1 text-xs font-bold tracking-[0.12em] text-cinza uppercase">{t.theme}</p>
              <ThemeSwitch className="w-full" />
            </div>
            <div className="grid gap-1.5 border-t border-borda pt-3">
              <p className="px-1 text-xs font-bold tracking-[0.12em] text-cinza uppercase">{t.language}</p>
              <LangSwitch />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
