import { addDaysIso } from "./format";
import type { Availability, UnavailableRange } from "./types";

export type DayState = UnavailableRange["reason"];

/** Dia ISO → motivo de indisponibilidade (BOOKED ganha a BLOCKED se coincidirem). */
export function unavailableDays(a: Availability | null | undefined): Map<string, DayState> {
  const out = new Map<string, DayState>();
  for (const r of a?.unavailable ?? []) {
    for (let d = r.start; d <= r.end; d = addDaysIso(d, 1)) {
      if (out.get(d) !== "BOOKED") out.set(d, r.reason);
    }
  }
  return out;
}

/**
 * Primeiro dia ocupado no período de reserva [start, end) — o dia de devolução não conta (fica livre para a
 * reserva seguinte, como na API). null = livre.
 */
export function firstConflict(days: Map<string, DayState>, start: string, end: string): string | null {
  if (!start || !end || end <= start) return null;
  for (let d = start; d < end; d = addDaysIso(d, 1)) {
    if (days.has(d)) return d;
  }
  return null;
}
