"use client";

import { formatFeeRate, useServiceFeeRate } from "@/lib/fee";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Clock, Hourglass, ShieldCheck, Users, X } from "lucide-react";
import { Avatar, ItemPhoto } from "./equipment";
import { SuccessCheck } from "./success";
import { Badge, ButtonLink, Kz } from "./ui";
import { bookingCode, bookingLabel, stepsDone, type NextStep } from "@/lib/booking";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import { daysBetween, formatDateTime, formatDay, formatDuration, formatKz, formatRange } from "@/lib/format";
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

/** Prazo ao vivo: normal (ambar-tint + relógio) → urgente < 3 h (erro-tint + alerta) → expirado (areia-2 + X). Sempre ícone + texto, sem animação contínua. */
export function DeadlineChip({ until, prefix, className }: { until: Date; prefix?: string; className?: string }) {
  const now = useNow();
  const lang = useLang();
  const t = useT().booking;
  if (now === null) return <span className={cn("inline-block h-8 w-32 rounded-full bg-skeleton", className)} aria-hidden />;
  const left = until.getTime() - now;
  const state = left <= 0 ? "expirado" : left < 3 * 3_600_000 ? "urgente" : "normal";
  const Icon = state === "expirado" ? X : state === "urgente" ? AlertTriangle : Clock;
  return (
    <span
      className={cn(
        "num inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold whitespace-nowrap",
        state === "normal" && "bg-ambar-tint text-aviso-texto",
        state === "urgente" && "bg-erro-tint text-erro",
        state === "expirado" && "bg-areia-2 text-cinza",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2.2} aria-hidden />
      {state === "expirado"
        ? fmt(t.deadlineExpired, { when: formatDateTime(until, lang) })
        : `${state === "urgente" ? t.deadlineUrgent : ""}${prefix ?? t.deadlineLeft} ${formatDuration(left, lang)}`}
    </span>
  );
}

// ── BookingTicket: a reserva como bilhete ─────────────────────────────────
/** Reserva como bilhete (verde, recortes laterais, picotado); leve inclinação 3D que endireita no hover (só com rato). */
export function BookingTicket({ booking, as }: { booking: Booking; as: "renter" | "owner" }) {
  const dict = useT();
  const t = dict.booking;
  const lang = useLang();
  const st = bookingLabel(booking.status, dict);
  const days = daysBetween(booking.startDate, booking.endDate);
  const other = as === "renter" ? { role: t.owner, name: booking.ownerName } : { role: t.renter, name: booking.renterName };
  return (
    <div className="animate-sobe">
    <article className="superficie-marca bilhete-3d relative overflow-hidden rounded-sheet bg-verde text-areia" aria-label={fmt(t.ticket, { code: bookingCode(booking.id) })}>
      <div className="hex-bg absolute inset-0 opacity-70" aria-hidden />
      <div className="relative flex gap-4 p-5">
        <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-24 shrink-0 rounded-campo bg-white/10 text-salvia" />
        <div className="grid min-w-0 content-start gap-1.5">
          <p className="num text-xs font-bold tracking-[0.12em] text-salvia uppercase">{fmt(t.ticket, { code: bookingCode(booking.id) })}</p>
          <h1 className="font-titulo text-xl leading-tight font-bold md:text-2xl">{booking.itemTitle}</h1>
          <Badge tone={st.tone} className="justify-self-start">{st.label}</Badge>
        </div>
      </div>
      {/* picotado com recortes laterais */}
      <div className="relative h-6" aria-hidden>
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-(--fundo-pagina)" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-(--fundo-pagina)" />
        <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-salvia/35" />
      </div>
      <dl className="relative grid grid-cols-3 gap-3 px-5 pt-1 pb-5">
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">{t.pickup}</dt>
          <dd className="font-titulo text-lg font-bold">{formatDay(booking.startDate, true, lang)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">{t.dropoff}</dt>
          <dd className="font-titulo text-lg font-bold">{formatDay(booking.endDate, true, lang)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">{t.days}</dt>
          <dd className="num font-titulo text-lg font-bold">{days}</dd>
        </div>
        <div className="col-span-3 flex items-center gap-3 border-t border-white/10 pt-3">
          <Avatar name={other.name} size="sm" className="bg-salvia text-verde" />
          <div className="min-w-0">
            <dt className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">{other.role}</dt>
            <dd className="truncate font-medium">{other.name}</dd>
          </div>
        </div>
      </dl>
    </article>
    </div>
  );
}

// ── NextStepCard ──────────────────────────────────────────────────────────
// label: chave em t.booking.who
const WHO = {
  you: { label: "you" as const, icon: Clock, box: "bg-ambar-tint", eyebrow: "text-aviso-texto", sub: "text-aviso-texto" },
  other: { label: "other" as const, icon: Hourglass, box: "bg-areia-2", eyebrow: "text-cinza", sub: "text-texto-corpo" },
  team: { label: "team" as const, icon: Users, box: "bg-erro-tint", eyebrow: "text-erro", sub: "text-texto-corpo" },
  done: { label: "done" as const, icon: Check, box: "bg-areia-2", eyebrow: "text-cinza", sub: "text-texto-corpo" },
};
const POSITIVE = { label: "positive" as const, icon: Check, box: "bg-salvia-tint", eyebrow: "text-verde-medio", sub: "text-texto-corpo" };

/**
 * Próximo passo no topo da reserva (v4): ambar-tint + relógio + "Próximo passo" quando és tu a agir;
 * `positive` (ex.: aluguer concluído) pinta-o de salvia-tint. Montante, prazo e ação opcionais.
 */
export function NextStepCard({ step, deadline, amount, positive }: { step: NextStep; deadline?: Date | null; amount?: number; positive?: boolean }) {
  const meta = positive ? POSITIVE : WHO[step.who];
  const Icon = meta.icon;
  const mine = step.who === "you";
  const t = useT().booking;
  return (
    <section aria-label={t.nextStepLabel} className={cn("grid animate-sobe gap-3 rounded-cartao p-4 md:p-5", meta.box)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] uppercase", meta.eyebrow)}>
        <Icon className="size-4" strokeWidth={2} aria-hidden />
        {t.who[meta.label]}
      </p>
      <div className="grid gap-1">
        <h2 className="font-titulo text-xl leading-tight font-bold text-verde md:text-2xl">{step.title}</h2>
        <p className={cn("text-[15px]", meta.sub)}>{step.text}</p>
      </div>
      {deadline && <DeadlineChip until={deadline} className="justify-self-start" />}
      {(amount !== undefined || step.cta) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {amount !== undefined && <Kz value={amount} className="text-2xl text-verde md:text-3xl" />}
          {step.cta && (
            <ButtonLink href={step.cta.href} variant={mine || positive ? "primary" : "secondary"} block={amount === undefined} className={cn(amount !== undefined && "ml-auto")}>
              {step.cta.label}
            </ButtonLink>
          )}
        </div>
      )}
    </section>
  );
}

// ── Timeline de 6 passos ──────────────────────────────────────────────────
/**
 * Timeline viva (v4): pedido → aceite → pago ao dono → entregue → devolvido → caução devolvida (rótulos em lib/booking).
 * Ao montar, a linha preenche e os pontos feitos acendem em sequência (uma vez). `orientation="horizontal"` para
 * desktop/blocos largos (6 colunas, linha com scaleX); vertical por omissão (telemóvel).
 */
export function Timeline({ booking, orientation = "vertical" }: { booking: Booking; orientation?: "vertical" | "horizontal" }) {
  const done = stepsDone(booking.status);
  const dict = useT();
  const t = dict.booking;
  const cancelled = booking.status === "CANCELLED_OWNER" || booking.status === "CANCELLED_RENTER" || booking.status === "EXPIRED";
  const disputed = booking.status === "DISPUTED";
  const steps = t.timeline.map((label, i) => {
    const isDone = i < done;
    const isProblem = disputed && i === done;
    const isNow = i === done && !cancelled && !isProblem;
    return { key: i, label: isProblem ? t.problemReported : label, isDone, isNow, isProblem };
  });
  const cancelNote = cancelled && (
    <p className="mt-3 flex items-center gap-2 text-sm font-medium text-erro">
      <X className="size-4" strokeWidth={2.2} aria-hidden /> {bookingLabel(booking.status, dict).label}
    </p>
  );

  if (orientation === "horizontal") {
    const n = steps.length;
    const progress = n > 1 ? Math.min(done, n - 1) / (n - 1) : 0;
    return (
      <div className="relative">
        {/* linha de progresso fora do <ol> (só <li> podem ser filhos de uma lista) */}
        <span aria-hidden className="absolute top-[13px] h-[3px] overflow-hidden rounded-full bg-borda" style={{ left: `${50 / n}%`, right: `${50 / n}%` }}>
          <span className="timeline-fill-x absolute inset-y-0 left-0 bg-salvia" style={{ width: `${progress * 100}%` }} />
        </span>
        <ol className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <li key={s.key} className="relative flex flex-col items-center gap-2 px-1 text-center" aria-current={s.isNow ? "step" : undefined}>
              <TimelineDot {...s} index={i} />
              <span className={cn("text-[13px] leading-tight", s.isDone || s.isNow || s.isProblem ? "font-bold text-verde" : "text-cinza")}>{s.label}</span>
              {s.isNow && <span className="text-xs text-aviso-texto">{t.now}</span>}
            </li>
          ))}
        </ol>
        {cancelNote}
      </div>
    );
  }

  return (
    <div>
      <ol className="grid">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={s.key} className="flex gap-3" aria-current={s.isNow ? "step" : undefined}>
              <div className="flex w-7 flex-col items-center">
                <TimelineDot {...s} index={i} />
                {!last && (
                  <span aria-hidden className="relative w-0.5 flex-1 overflow-hidden bg-borda">
                    {s.isDone && <span className="timeline-fill-y absolute inset-0 bg-salvia" style={{ "--i": i } as React.CSSProperties} />}
                  </span>
                )}
              </div>
              <div className={cn("pb-5", last && "pb-0")}>
                <p className={cn("text-[15px]", s.isDone || s.isNow || s.isProblem ? "font-bold text-verde" : "text-cinza")}>{s.label}</p>
                {s.isNow && <p className="text-[13px] text-aviso-texto">{t.now}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {cancelNote}
    </div>
  );
}

/** Ponto da timeline: feito (salvia + check), agora (anel âmbar), problema (erro + alerta), por fazer (contorno). */
function TimelineDot({ isDone, isNow, isProblem, index }: { isDone: boolean; isNow: boolean; isProblem: boolean; index: number }) {
  const t = useT().booking;
  return (
    <span
      className={cn(
        "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-2",
        isDone && "timeline-acende border-salvia bg-salvia text-verde",
        isNow && "border-ambar bg-ambar-tint ring-4 ring-ambar/25",
        isProblem && "border-erro bg-erro text-branco",
        !isDone && !isNow && !isProblem && "border-borda-forte bg-branco",
      )}
      style={isDone ? ({ "--i": index } as React.CSSProperties) : undefined}
    >
      {isDone ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : isProblem ? <AlertTriangle className="size-3.5" strokeWidth={2.5} aria-hidden /> : null}
      <span className="sr-only">{isDone ? t.done : isNow ? t.now : isProblem ? t.problem : t.todo}</span>
    </span>
  );
}

// ── PriceSummary: aluguer + taxa 8% + caução separada ─────────────────────
/** Resumo de preço (v4): aluguer, taxa de serviço (PAYMENTS_SERVICE_FEE_RATE), caução com badge "reembolsável", total "Pagas ao dono na entrega". `as="owner"` mostra o que o dono recebe. */
export function PriceSummary({
  pricePerDay, days, deposit, as = "renter", serviceFee,
}: { pricePerDay: number; days: number; deposit: number; as?: "renter" | "owner"; serviceFee?: number }) {
  const feeRate = useServiceFeeRate(); // PAYMENTS_SERVICE_FEE_RATE, via API
  const rental = Math.round(pricePerDay * days);
  const fee = serviceFee ?? Math.round(rental * feeRate);
  const dict = useT();
  const t = dict.booking.price;
  const lang = useLang();
  const daysLabel = fmt(t.daysTimes, { days: plural(days, dict.common.days), price: formatKz(pricePerDay) });
  // Pagamento direto (2026-11-15): o arrendatário paga tudo ao dono na entrega; o dono entrega a taxa à Beeznoo
  if (as === "owner") {
    return (
      <div className="grid gap-3 text-[15px]">
        <div className="grid gap-1">
          <p className="text-sm text-cinza">{t.youKeep}</p>
          <Kz value={rental} className="text-3xl text-verde" />
          <p className="text-[13px] text-cinza">{daysLabel}</p>
        </div>
        <div className="grid gap-2 border-t border-borda pt-3">
          <Row label={t.receiveAtHandover} value={formatKz(rental + fee + deposit)} />
          <Row label={t.feeToBeeznoo} value={formatKz(fee)} />
          {deposit > 0 && <Row label={t.depositToReturn} value={formatKz(deposit)} />}
        </div>
      </div>
    );
  }
  return (
    <div className="grid text-[15px]">
      <Row label={daysLabel} value={formatKz(rental)} divided />
      <Row label={fmt(t.fee, { rate: formatFeeRate(feeRate, lang) })} value={formatKz(fee)} divided />
      <Row
        label={
          <span className="flex flex-wrap items-center gap-2">
            {t.deposit}
            <Badge tone="ok" icon={ShieldCheck} className="h-6 px-2 text-xs">{t.refundable}</Badge>
          </span>
        }
        value={formatKz(deposit)}
        hint={t.depositHint}
        divided
      />
      <div className="flex items-end justify-between gap-3 pt-3">
        <span className="font-bold text-verde">{t.payOwner}</span>
        <Kz value={rental + fee + deposit} className="text-2xl text-verde" />
      </div>
    </div>
  );
}

/** Linha rótulo → valor do PriceSummary (opcionalmente com nota e divisória). */
function Row({ label, value, hint, divided }: { label: React.ReactNode; value: string; hint?: string; divided?: boolean }) {
  return (
    <div className={cn("grid gap-0.5", divided && "border-b border-borda py-2.5")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-texto-corpo">{label}</span>
        <span className="num font-medium text-verde">{value}</span>
      </div>
      {hint && <p className="text-[13px] text-cinza">{hint}</p>}
    </div>
  );
}

// ── Linhas de lista ───────────────────────────────────────────────────────
/** Linha de reserva em listas (foto, nome, datas, estado). */
export function BookingRow({ booking, as, index = 0 }: { booking: Booking; as: "renter" | "owner"; index?: number }) {
  const dict = useT();
  const lang = useLang();
  const st = bookingLabel(booking.status, dict);
  return (
    <Link
      href={`/reservas/${booking.id}`}
      className="levantar flex animate-sobe items-center gap-3 rounded-cartao border border-borda bg-branco p-3 active:scale-[.99]"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-20 shrink-0 rounded-campo" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="truncate font-titulo font-bold text-verde">{booking.itemTitle}</p>
        <p className="truncate text-[13px] text-cinza">
          {formatRange(booking.startDate, booking.endDate, lang)} · {as === "renter" ? booking.ownerName : booking.renterName}
        </p>
        <Badge tone={st.tone} className="justify-self-start">{st.label}</Badge>
      </div>
      <ChevronRight className="size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

/** Confirmação em linha (ex.: "Pedido enviado!") com o SuccessCheck v4. */
export function SuccessBurst({ title, text }: { title: string; text: React.ReactNode }) {
  return (
    <div role="status" className="flex animate-sobe items-start gap-3 rounded-cartao bg-salvia-tint p-4 text-verde">
      <SuccessCheck size={40} className="bg-branco" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}
