"use client";

import { useId, useState } from "react";
import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react";
import { HexTile } from "./hex";
import { Card } from "./ui";
import { cn } from "@/lib/utils";

/**
 * Gráficos do admin, sem biblioteca (decisoes-produto.md 2026-11-15).
 * Uma série por gráfico, no verde da marca (`verde-medio`, que muda no modo escuro); sem eixo duplo;
 * valores sempre em texto (tooltip ao passar/focar e tabela), nunca só pela cor.
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11" → "nov" (ou "nov 26" quando pedido o ano). */
export function monthLabel(ym: string, withYear = false) {
  const [y, m] = ym.split("-").map(Number);
  return withYear ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : MONTHS[m - 1];
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** variação face ao período anterior (em unidades); null = sem comparação */
  delta?: { value: number; label: string } | null;
  accent?: boolean;
}) {
  const DeltaIcon = !delta ? null : delta.value > 0 ? TrendingUp : delta.value < 0 ? TrendingDown : Minus;
  return (
    <Card className={cn("grid content-start gap-2 p-5", accent && "border-verde bg-salvia-tint/40")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-cinza">{label}</p>
        {Icon && <HexTile icon={Icon} tone={accent ? "verde" : "areia"} size={36} />}
      </div>
      <p className={cn("num font-titulo leading-none font-bold tracking-tight text-verde", accent ? "text-5xl" : "text-3xl")}>{value}</p>
      {delta && DeltaIcon && (
        <p className="flex items-center gap-1.5 text-sm text-texto-corpo">
          <DeltaIcon className="size-4 text-cinza" strokeWidth={2} aria-hidden />
          <span>
            {delta.value > 0 ? "+" : ""}
            {delta.value} {delta.label}
          </span>
        </p>
      )}
      {hint && <p className="text-sm text-cinza">{hint}</p>}
    </Card>
  );
}

type Bar = { key: string; label: string; value: number; note?: string };

/**
 * Barras verticais de uma série (ex.: alugueres concluídos por mês). Barra com topo arredondado (4px) assente na
 * base, grelha discreta, rótulo de valor só no máximo e na última barra, tooltip ao passar ou focar (teclado),
 * e "Ver tabela" com os mesmos números.
 */
export function BarChart({
  title,
  description,
  bars,
  format = (v) => v.toLocaleString("de-DE"),
  emptyText = "Ainda sem dados neste período.",
}: {
  title: string;
  description?: string;
  bars: Bar[];
  format?: (v: number) => string;
  emptyText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const max = Math.max(0, ...bars.map((b) => b.value));
  const top = niceMax(max);
  const maxIndex = bars.findIndex((b) => b.value === max && max > 0);
  const labelled = new Set([maxIndex, bars.length - 1]);
  const empty = max === 0;

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id={`${id}-t`} className="font-titulo text-lg font-bold text-verde">{title}</h2>
          {description && <p className="text-sm text-cinza">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          aria-pressed={table}
          className="min-h-11 cursor-pointer rounded-campo px-3 text-sm font-medium text-mel-texto underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-verde"
        >
          {table ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      {table ? (
        <table className="w-full text-left text-[15px]" aria-labelledby={`${id}-t`}>
          <thead>
            <tr className="border-b border-borda text-xs tracking-[0.1em] text-cinza uppercase">
              <th scope="col" className="py-2 font-bold">Período</th>
              <th scope="col" className="py-2 text-right font-bold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.key} className="border-b border-borda last:border-0">
                <th scope="row" className="py-2 font-medium text-texto-corpo">
                  {b.label}
                  {b.note && <span className="ml-2 text-sm text-cinza">({b.note})</span>}
                </th>
                <td className="num py-2 text-right font-bold text-verde">{format(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          {/* grelha: 0, metade e topo */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-7 grid grid-rows-2">
            <div className="border-t border-dashed border-borda" />
            <div className="border-t border-dashed border-borda" />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-7 border-t border-borda-forte" />
          <ul
            className="relative grid h-52 items-end gap-0.5"
            style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
            aria-labelledby={`${id}-t`}
            onMouseLeave={() => setActive(null)}
          >
            {bars.map((b, i) => {
              const h = top === 0 ? 0 : (b.value / top) * 100;
              const on = active === i;
              return (
                <li key={b.key} className="relative grid h-full grid-rows-[1fr_auto] justify-items-center">
                  <button
                    type="button"
                    aria-label={`${b.label}${b.note ? ` (${b.note})` : ""}: ${format(b.value)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="group relative flex h-full w-full cursor-default items-end justify-center px-[18%] focus-visible:outline-2 focus-visible:outline-verde"
                  >
                    {labelled.has(i) && !on && b.value > 0 && (
                      <span
                        className="num absolute left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-texto-corpo"
                        style={{ bottom: `calc(${h}% + 4px)` }}
                      >
                        {format(b.value)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "block w-full max-w-12 rounded-t-[4px] bg-verde-medio transition-opacity duration-200 ease-out motion-reduce:transition-none",
                        b.note && "opacity-70",
                        active !== null && !on && "opacity-50",
                      )}
                      style={{ height: b.value > 0 ? `max(${h}%, 2px)` : "0" }}
                    />
                    {on && (
                      <span
                        role="tooltip"
                        className="absolute left-1/2 z-10 -translate-x-1/2 rounded-campo border border-borda bg-branco px-3 py-2 text-left whitespace-nowrap shadow-lg"
                        style={{ bottom: `calc(${h}% + 8px)` }}
                      >
                        <span className="block text-xs text-cinza">
                          {b.label}
                          {b.note ? ` · ${b.note}` : ""}
                        </span>
                        <span className="num block font-bold text-verde">{format(b.value)}</span>
                      </span>
                    )}
                  </button>
                  {/* altura fixa (h-7 = 28px): a linha de base e a grelha estão a bottom-7 */}
                  <span className="h-7 pt-2 text-xs leading-none text-cinza">{b.label}</span>
                </li>
              );
            })}
          </ul>
          {empty && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-cinza">{emptyText}</p>}
        </div>
      )}
    </Card>
  );
}

/** Funil: barras horizontais com a % face ao primeiro passo. Uma cor; o texto diz tudo. */
export function Funnel({
  title,
  description,
  steps,
}: {
  title: string;
  description?: string;
  steps: { label: string; value: number; hint?: string }[];
}) {
  const base = steps[0]?.value ?? 0;
  return (
    <Card className="grid gap-4 p-5">
      <div className="grid gap-0.5">
        <h2 className="font-titulo text-lg font-bold text-verde">{title}</h2>
        {description && <p className="text-sm text-cinza">{description}</p>}
      </div>
      <ol className="grid gap-3">
        {steps.map((s, i) => {
          const pct = base === 0 ? 0 : Math.round((s.value / base) * 100);
          return (
            <li key={s.label} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="font-medium text-texto-corpo">{s.label}</span>
                <span className="num text-texto-corpo">
                  <b className="text-verde">{s.value.toLocaleString("de-DE")}</b>
                  {i > 0 && base > 0 && <span className="ml-2 text-sm text-cinza">{pct}%</span>}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-areia-2" aria-hidden>
                <div
                  className="h-full rounded-full bg-verde-medio"
                  style={{ width: `${base === 0 ? 0 : Math.max((s.value / base) * 100, s.value > 0 ? 2 : 0)}%` }}
                />
              </div>
              {s.hint && <p className="text-xs text-cinza">{s.hint}</p>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Topo "redondo" do eixo: 7 → 8, 23 → 25, 140.000 → 150.000. */
function niceMax(v: number) {
  if (v <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
