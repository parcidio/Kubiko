"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["S", "T", "Q", "Q", "S", "S", "D"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mês com dias selecionáveis (bloquear datas). `marked` = dias já marcados. */
export function MonthCalendar({ marked, onToggle, busy = [] }: { marked: Set<string>; onToggle: (day: string) => void; busy?: string[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const first = (cursor.getDay() + 6) % 7; // segunda = 0
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const todayIso = iso(today);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex size-11 items-center justify-center rounded-full hover:bg-areia-2">
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
          const isBusy = busy.includes(day);
          const on = marked.has(day);
          return (
            <button
              key={day}
              type="button"
              disabled={past || isBusy}
              aria-pressed={on}
              aria-label={`${i + 1} ${MONTHS[cursor.getMonth()]}${isBusy ? ", reservado" : on ? ", bloqueado" : ""}`}
              onClick={() => onToggle(day)}
              className={cn(
                "num flex h-11 items-center justify-center rounded-campo text-sm transition",
                past && "text-borda-forte",
                isBusy && "bg-areia-2 text-cinza line-through",
                on && "bg-[repeating-linear-gradient(135deg,#0E2A1F_0_4px,#1F5C42_4px_8px)] font-bold text-areia",
                !past && !isBusy && !on && "text-verde hover:bg-areia-2",
                day === todayIso && !on && "ring-2 ring-ambar",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-[13px] text-cinza">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-[repeating-linear-gradient(135deg,#0E2A1F_0_3px,#1F5C42_3px_6px)]" /> Bloqueado por ti</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-areia-2" /> Reservado</span>
      </div>
    </div>
  );
}
