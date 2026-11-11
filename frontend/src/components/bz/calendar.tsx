"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayState } from "@/lib/availability";
import { cn } from "@/lib/utils";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["S", "T", "Q", "Q", "S", "S", "D"];
const STRIPES = "bg-[repeating-linear-gradient(135deg,#0E2A1F_0_4px,#1F5C42_4px_8px)]";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Seleção no calendário. `endInclusive`: bloqueio do dono (16 a 18 = 3 dias); sem ele é uma reserva
 * [início, fim) e o dia de devolução aparece só com contorno.
 */
export type CalendarSelection = { start: string; end?: string; endInclusive?: boolean };

/**
 * Mês com disponibilidade. `days` = dias indisponíveis (BOOKED/BLOCKED).
 * mode "owner": bloqueios às riscas ("Bloqueado por ti"); "public": tudo como "Indisponível", sem detalhes.
 * Com `onDayClick`, os dias livres são botões; sem ele, o calendário é só de leitura.
 */
export function MonthCalendar({
  days, mode, selection, onDayClick, initialMonth,
}: {
  days: Map<string, DayState>;
  mode: "owner" | "public";
  selection?: CalendarSelection;
  onDayClick?: (day: string) => void;
  initialMonth?: string;
}) {
  const today = new Date();
  const start = initialMonth ? new Date(`${initialMonth.slice(0, 7)}-01T00:00:00`) : today;
  const [cursor, setCursor] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const first = (cursor.getDay() + 6) % 7; // segunda = 0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const todayIso = iso(today);
  const atCurrentMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  const selStart = selection?.start;
  const selEnd = selection?.end ?? selection?.start;
  const inSelection = (d: string) =>
    !!selStart && !!selEnd && d >= selStart && (selection?.endInclusive ? d <= selEnd : d < selEnd);
  const isReturnDay = (d: string) => !!selection?.end && !selection.endInclusive && d === selection.end;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={atCurrentMonth}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="flex size-11 items-center justify-center rounded-full hover:bg-areia-2 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" strokeWidth={1.8} />
        </button>
        <p className="font-titulo font-bold text-verde" aria-live="polite">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>
        <button type="button" aria-label="Mês seguinte" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex size-11 items-center justify-center rounded-full hover:bg-areia-2">
          <ChevronRight className="size-5" strokeWidth={1.8} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d, i) => (
          <span key={i} className="py-1 text-xs font-bold text-cinza" aria-hidden>
            {d}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = iso(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1));
          const past = day < todayIso;
          const state = days.get(day);
          const selected = inSelection(day);
          const conflict = selected && !!state;
          const interactive = !!onDayClick && !past && !state;
          const label = `${i + 1} ${MONTHS[cursor.getMonth()]}${
            state === "BOOKED" ? (mode === "owner" ? ", reservado" : ", indisponível")
              : state === "BLOCKED" ? (mode === "owner" ? ", bloqueado por ti" : ", indisponível")
                : selected ? ", selecionado" : isReturnDay(day) ? ", devolução" : ""
          }`;
          const cls = cn(
            "num flex h-11 items-center justify-center rounded-campo text-sm transition",
            past && "text-borda-forte",
            !past && state === "BOOKED" && "bg-areia-2 text-cinza line-through",
            !past && state === "BLOCKED" && (mode === "owner" ? cn(STRIPES, "font-bold text-areia") : "bg-areia-2 text-cinza line-through"),
            selected && !state && "bg-verde font-bold text-areia",
            conflict && "bg-erro font-bold text-branco no-underline",
            isReturnDay(day) && !state && "font-bold text-verde ring-2 ring-verde ring-inset",
            interactive && !selected && "text-verde hover:bg-areia-2",
            !interactive && !past && !state && !selected && !isReturnDay(day) && "text-verde",
            day === todayIso && !selected && !state && !isReturnDay(day) && "ring-2 ring-ambar",
          );
          return interactive ? (
            <button key={day} type="button" aria-label={label} aria-pressed={selected} onClick={() => onDayClick!(day)} className={cls}>
              {i + 1}
            </button>
          ) : (
            <span key={day} aria-label={label} className={cls}>
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-[13px] text-cinza">
        {mode === "owner" ? (
          <>
            <span className="flex items-center gap-1.5"><i className={cn("size-3.5 rounded", STRIPES)} /> Bloqueado por ti</span>
            <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-areia-2" /> Reservado</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-areia-2" /> Indisponível</span>
        )}
        {selection && (
          <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-verde" /> {mode === "owner" ? "A bloquear" : "As tuas datas"}</span>
        )}
      </div>
    </div>
  );
}
