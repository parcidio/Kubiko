import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const UNAVAILABLE_DAYS = [3, 4, 17, 18, 24, 25];
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type CalendarSelection = { start: number | null; end: number | null };

export default function Calendar({ selected, onSelect } : { selected: CalendarSelection; onSelect: (day: number) => void;}) 
{
  const [month, setMonth] = useState(9);
  const [year] = useState(2026);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array(firstDay === 0 ? 6 : firstDay - 1).fill(null);

  return (
    <div className="rounded-xs bg-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMonth((current) => Math.max(0, current - 1))}
          disabled={month === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">
          {MONTHS[month]} {year}
        </p>
        <button
          type="button"
          aria-label="Mês seguinte"
          onClick={() => setMonth((current) => Math.min(11, current + 1))}
          disabled={month === 11}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, index) => (
          <p
            key={`${day}-${index}`}
            className="pb-1 text-[11px] font-medium text-muted-foreground"
          >
            {day}
          </p>
        ))}
        {blanks.map((_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
          (day) => {
            const unavailable = UNAVAILABLE_DAYS.includes(day);
            const isStart = selected.start === day;
            const isEnd = selected.end === day;
            const inRange =
              selected.start !== null &&
              selected.end !== null &&
              day > selected.start &&
              day < selected.end;

            return (
              <button
                key={day}
                type="button"
                disabled={unavailable}
                onClick={() => onSelect(day)}
                aria-pressed={isStart || isEnd}
                className={`min-w-0 rounded-xs py-2 text-xs transition-colors ${
                  unavailable
                    ? "cursor-not-allowed bg-muted text-muted-foreground/40 line-through"
                    : isStart || isEnd
                      ? "bg-primary font-bold text-primary-foreground"
                      : inRange
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-muted"
                }`}
              >
                {day}
              </button>
            );
          },
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-primary" /> As tuas datas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs bg-muted-foreground/30" />
          Indisponível
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-xs border border-border" /> Livre
        </span>
      </div>
    </div>
  );
}
