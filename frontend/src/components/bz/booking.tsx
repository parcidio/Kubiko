"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, ChevronRight, Clock, Hourglass, PartyPopper, ShieldCheck, Users, X } from "lucide-react";
import { Avatar, ItemPhoto } from "./equipment";
import { Badge, ButtonLink, Kz } from "./ui";
import { BOOKING_LABEL, TIMELINE_STEPS, bookingCode, stepsDone, type NextStep } from "@/lib/booking";
import { SERVICE_FEE_RATE, daysBetween, formatDateTime, formatDay, formatDuration, formatKz, formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/types";

// ── DeadlineChip: contagem ao vivo, normal → urgente (< 3 h) → expirado ────
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function DeadlineChip({ until, prefix = "Faltam", className }: { until: Date; prefix?: string; className?: string }) {
  const now = useNow();
  if (now === null) return <span className={cn("inline-block h-8 w-32 rounded-full bg-skeleton", className)} aria-hidden />;
  const left = until.getTime() - now;
  const state = left <= 0 ? "expirado" : left < 3 * 3_600_000 ? "urgente" : "normal";
  return (
    <span
      className={cn(
        "num inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold whitespace-nowrap",
        state === "normal" && "bg-ambar-tint text-aviso-texto",
        state === "urgente" && "bg-erro-tint text-erro",
        state === "expirado" && "bg-areia-2 text-cinza line-through",
        className,
      )}
    >
      {state === "urgente" ? (
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-pulso rounded-full bg-erro" />
        </span>
      ) : state === "expirado" ? (
        <X className="size-4" strokeWidth={2.2} aria-hidden />
      ) : (
        <Clock className="size-4" strokeWidth={2.2} aria-hidden />
      )}
      {state === "expirado" ? `Expirou ${formatDateTime(until)}` : `${prefix} ${formatDuration(left)}`}
    </span>
  );
}

// ── BookingTicket: a reserva como bilhete ─────────────────────────────────
export function BookingTicket({ booking, as }: { booking: Booking; as: "renter" | "owner" }) {
  const st = BOOKING_LABEL[booking.status];
  const days = daysBetween(booking.startDate, booking.endDate);
  const other = as === "renter" ? { role: "Dono", name: booking.ownerName } : { role: "Arrendatário", name: booking.renterName };
  return (
    <article className="relative animate-sobe overflow-hidden rounded-sheet bg-verde text-areia" aria-label={`Reserva ${bookingCode(booking.id)}`}>
      <div className="hex-bg absolute inset-0 opacity-70" aria-hidden />
      <div className="relative flex gap-4 p-5">
        <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-24 shrink-0 rounded-campo bg-white/10 text-ambar" />
        <div className="grid min-w-0 content-start gap-1.5">
          <p className="num text-xs font-bold tracking-[0.14em] text-ambar">{bookingCode(booking.id)}</p>
          <h1 className="font-titulo text-xl leading-tight font-bold md:text-2xl">{booking.itemTitle}</h1>
          <Badge tone={st.tone} className="justify-self-start">{st.label}</Badge>
        </div>
      </div>
      {/* picotado com recortes laterais */}
      <div className="relative h-6" aria-hidden>
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-areia" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-areia" />
        <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-white/20" />
      </div>
      <dl className="relative grid grid-cols-3 gap-3 px-5 pt-1 pb-5">
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Levanta</dt>
          <dd className="font-titulo text-lg font-bold">{formatDay(booking.startDate, true)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Devolve</dt>
          <dd className="font-titulo text-lg font-bold">{formatDay(booking.endDate, true)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Dias</dt>
          <dd className="num font-titulo text-lg font-bold">{days}</dd>
        </div>
        <div className="col-span-3 flex items-center gap-3 border-t border-white/10 pt-3">
          <Avatar name={other.name} size="sm" className="bg-ambar text-verde" />
          <div className="min-w-0">
            <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">{other.role}</dt>
            <dd className="truncate font-medium">{other.name}</dd>
          </div>
        </div>
      </dl>
    </article>
  );
}

// ── NextStepCard ──────────────────────────────────────────────────────────
const WHO = {
  you: { label: "Próximo passo · tu", icon: ArrowRight },
  other: { label: "À espera da outra parte", icon: Hourglass },
  team: { label: "Com a equipa Beeznoo", icon: Users },
  done: { label: "Fechado", icon: Check },
};

export function NextStepCard({ step, deadline, amount }: { step: NextStep; deadline?: Date | null; amount?: number }) {
  const meta = WHO[step.who];
  const Icon = meta.icon;
  const mine = step.who === "you";
  return (
    <section
      aria-label="Próximo passo"
      className={cn(
        "grid animate-sobe gap-3 rounded-sheet p-5",
        mine ? "border-2 border-verde bg-branco" : step.who === "team" ? "bg-erro-tint" : "bg-areia-2",
      )}
    >
      <p className={cn("flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] uppercase", mine ? "text-verde-medio" : "text-cinza")}>
        <Icon className="size-4" strokeWidth={2} aria-hidden />
        {meta.label}
      </p>
      <div className="grid gap-1">
        <h2 className="font-titulo text-2xl leading-tight font-bold text-verde">{step.title}</h2>
        <p className="text-texto-corpo">{step.text}</p>
      </div>
      {amount !== undefined && <Kz value={amount} className="text-4xl text-verde" />}
      {deadline && <DeadlineChip until={deadline} className="justify-self-start" />}
      {step.cta && (
        <ButtonLink href={step.cta.href} variant={mine ? "primary" : "outline"} block className="mt-1">
          {step.cta.label}
        </ButtonLink>
      )}
    </section>
  );
}

// ── Timeline de 6 passos (nós em hexágono) ────────────────────────────────
export function Timeline({ booking }: { booking: Booking }) {
  const done = stepsDone(booking.status);
  const cancelled = booking.status === "CANCELLED_OWNER" || booking.status === "CANCELLED_RENTER";
  const disputed = booking.status === "DISPUTED";
  return (
    <ol className="grid">
      {TIMELINE_STEPS.map((label, i) => {
        const isDone = i < done;
        const isNow = i === done && !cancelled;
        const isProblem = disputed && i === done;
        const last = i === TIMELINE_STEPS.length - 1;
        return (
          <li key={label} className="flex gap-3">
            <div className="flex w-7 flex-col items-center">
              <span
                className={cn(
                  "flex size-7 items-center justify-center text-branco [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]",
                  isDone ? "bg-verde-medio" : isProblem ? "bg-erro" : isNow ? "bg-ambar" : "bg-borda",
                )}
              >
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : isProblem ? <AlertTriangle className="size-3.5" strokeWidth={2.5} /> : null}
              </span>
              {!last && <span className={cn("w-0.5 flex-1", isDone ? "bg-verde-medio" : "bg-borda")} />}
            </div>
            <div className={cn("pb-5", last && "pb-0")}>
              <p className={cn("text-[15px]", isDone || isNow ? "font-bold text-verde" : "text-cinza")}>
                {isProblem ? "Problema reportado" : label}
              </p>
              {isNow && !isProblem && <p className="text-[13px] text-aviso-texto">Agora</p>}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="mt-2 flex items-center gap-2 text-sm font-medium text-erro">
          <X className="size-4" strokeWidth={2.2} aria-hidden /> {BOOKING_LABEL[booking.status].label}
        </li>
      )}
    </ol>
  );
}

// ── PriceSummary: aluguer + taxa 8% + caução separada ─────────────────────
export function PriceSummary({
  pricePerDay, days, deposit, as = "renter", serviceFee,
}: { pricePerDay: number; days: number; deposit: number; as?: "renter" | "owner"; serviceFee?: number }) {
  const rental = Math.round(pricePerDay * days);
  const fee = serviceFee ?? Math.round(rental * SERVICE_FEE_RATE);
  if (as === "owner") {
    return (
      <div className="grid gap-1">
        <p className="text-sm text-cinza">Recebes</p>
        <Kz value={rental} className="text-3xl text-verde" />
        <p className="text-[13px] text-cinza">
          {days} {days === 1 ? "dia" : "dias"} × {formatKz(pricePerDay)}. A taxa de serviço é paga pelo arrendatário.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 text-[15px]">
      <Row label={`${formatKz(pricePerDay)} × ${days} ${days === 1 ? "dia" : "dias"}`} value={formatKz(rental)} />
      <Row label="Taxa de serviço (8%)" value={formatKz(fee)} />
      <div className="grid gap-1 rounded-campo border-2 border-dashed border-salvia bg-salvia-tint/60 p-3">
        <Row
          label={
            <span className="flex items-center gap-1.5 font-bold text-verde">
              <ShieldCheck className="size-4 text-verde-medio" strokeWidth={2} aria-hidden /> Caução reembolsável
            </span>
          }
          value={formatKz(deposit)}
        />
        <p className="text-[13px] text-cinza">Devolvida depois da devolução, se estiver tudo em ordem.</p>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-borda pt-3">
        <span className="font-bold text-verde">Total a pagar</span>
        <Kz value={rental + fee + deposit} className="text-2xl text-verde" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-texto-corpo">{label}</span>
      <span className="num font-medium text-verde">{value}</span>
    </div>
  );
}

// ── Linhas de lista ───────────────────────────────────────────────────────
export function BookingRow({ booking, as, index = 0 }: { booking: Booking; as: "renter" | "owner"; index?: number }) {
  const st = BOOKING_LABEL[booking.status];
  return (
    <Link
      href={`/reservas/${booking.id}`}
      className="flex animate-sobe items-center gap-3 rounded-cartao border border-borda bg-branco p-3 transition hover:border-borda-forte active:scale-[.99]"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-20 shrink-0 rounded-campo" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="truncate font-titulo font-bold text-verde">{booking.itemTitle}</p>
        <p className="truncate text-[13px] text-cinza">
          {formatRange(booking.startDate, booking.endDate)} · {as === "renter" ? booking.ownerName : booking.renterName}
        </p>
        <Badge tone={st.tone} className="justify-self-start">{st.label}</Badge>
      </div>
      <ChevronRight className="size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

export function SuccessBurst({ title, text }: { title: string; text: React.ReactNode }) {
  return (
    <div role="status" className="flex animate-sobe items-start gap-3 rounded-sheet bg-salvia-tint p-4 text-verde">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-verde-medio text-branco">
        <PartyPopper className="size-5" strokeWidth={1.8} aria-hidden />
      </span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}
