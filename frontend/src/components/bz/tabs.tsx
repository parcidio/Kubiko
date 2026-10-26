"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Separadores em pílula, com setas do teclado (padrão ARIA tabs). */
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
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-full p-1", dark ? "bg-white/10" : "bg-areia-2", className)}
    >
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
              "flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition",
              on
                ? dark
                  ? "bg-areia font-bold text-verde"
                  : "bg-branco font-bold text-verde shadow-[0_1px_2px_rgba(14,42,31,.12)]"
                : dark
                  ? "text-areia/80 hover:text-areia"
                  : "text-cinza hover:text-verde",
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span className={cn("num min-w-5 rounded-full px-1.5 text-xs font-bold", on ? "bg-verde text-areia" : "bg-borda text-verde")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
