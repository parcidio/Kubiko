"use client";

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Separadores (role=tablist) com setas do teclado; visual v4: fundo areia-2, raio 14, ativa verde com texto areia. */
export function Segmented<T extends string>({
  label, value, onChange, options, className, dark,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
  dark?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = options.findIndex((o) => o.value === value);

  function onKey(e: React.KeyboardEvent, i: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("relative grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] p-1", dark ? "bg-white/10" : "bg-areia-2", className)}
    >
      {/* pílula que desliza até à opção ativa (colunas iguais: posição = índice × (largura + gap)) */}
      {active >= 0 && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 rounded-[10px] transition-transform duration-350 ease-out",
            dark ? "bg-areia" : "bg-verde",
          )}
          style={{
            width: `calc((100% - 0.5rem - ${options.length - 1} * 0.25rem) / ${options.length})`,
            transform: `translateX(calc(${active} * (100% + 0.25rem)))`,
          }}
        />
      )}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative flex min-h-11 items-center justify-center cursor-pointer gap-2 rounded-[10px] px-3 text-sm font-medium transition-colors",
              on
                ? dark ? "font-bold text-verde" : "font-bold text-areia"
                : dark
                  ? "text-areia/80 hover:text-areia"
                  : "text-cinza hover:text-verde",
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span className={cn("num min-w-5 rounded-full px-1.5 text-xs font-bold", on ? (dark ? "bg-verde text-areia" : "bg-ambar text-sobre-ambar") : "bg-borda text-verde")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * SegmentedControl (v4): escolha entre 2–4 opções que mudam o conteúdo do mesmo ecrã (ex.: "Dinheiro" / "Transferência").
 * Botões com `aria-pressed` dentro de role=group (não é tablist: para separadores usa `Segmented`).
 * Fundo areia-2, raio 14; opção ativa verde com texto areia.
 */
export function SegmentedControl<T extends string>({
  label, value, onChange, options, className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; count?: number }[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid auto-cols-fr grid-flow-col gap-1.5 rounded-[14px] bg-areia-2 p-[5px]", className)}
    >
      {options.map(({ value: v, label: l, icon: Icon, count }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-medium transition-colors duration-200",
              on ? "bg-verde font-bold text-areia" : "text-verde hover:bg-branco/60",
            )}
          >
            {Icon && <Icon className={cn("size-4 shrink-0", on ? "text-ambar" : "text-mel")} strokeWidth={1.8} aria-hidden />}
            {l}
            {count !== undefined && count > 0 && (
              <span className={cn("num min-w-5 rounded-full px-1.5 text-xs font-bold", on ? "bg-ambar text-sobre-ambar" : "bg-borda text-verde")}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
