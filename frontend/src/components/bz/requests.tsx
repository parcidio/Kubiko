"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { DeadlineChip } from "./booking";
import { Avatar, ItemPhoto } from "./equipment";
import { ChipGroup, TextArea } from "./form";
import { Sheet, toast } from "./overlay";
import { Button, Card, Kz } from "./ui";
import { bookingApi } from "@/lib/api";
import { bookingCode, deadlineOf, firstName } from "@/lib/booking";
import { daysBetween, formatRange } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";


/** Aceitar / Recusar um pedido (dono). Recusar pede motivo em chips. */
export function RequestActions({ booking, onDone, compact }: { booking: Booking; onDone: (b: Booking) => void; compact?: boolean }) {
  const [sheet, setSheet] = useState<"accept" | "decline" | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const dict = useT();
  const t = dict.requests;
  const lang = useLang();

  async function run() {
    setBusy(true);
    try {
      const ownerNote = [sheet === "decline" ? reason : undefined, note.trim()].filter(Boolean).join(" — ") || undefined;
      const updated = sheet === "accept" ? await bookingApi.accept(booking.id, ownerNote) : await bookingApi.cancel(booking.id, ownerNote);
      toast.success(sheet === "accept" ? fmt(t.accepted, { name: firstName(booking.renterName, dict) }) : t.declined);
      setSheet(null);
      onDone(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.replyError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={compact ? "grid grid-cols-2 gap-2" : "grid gap-2 sm:grid-cols-2"}>
        <Button variant="secondary" onClick={() => setSheet("decline")}>
          <X strokeWidth={2} /> {t.decline}
        </Button>
        {/* Na lista há vários pedidos: o âmbar fica para o detalhe (um por ecrã); aqui é verde-escuro. */}
        <Button variant={compact ? "dark" : "primary"} onClick={() => setSheet("accept")}>
          <Check strokeWidth={2.2} /> {t.accept}
        </Button>
      </div>
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === "accept" ? t.acceptTitle : t.declineTitle}
        footer={
          <Button block size="lg" variant={sheet === "accept" ? "primary" : "dark"} loading={busy} onClick={run} disabled={sheet === "decline" && !reason}>
            {sheet === "accept" ? t.acceptCta : t.declineTitle}
          </Button>
        }
      >
        <div className="grid gap-4 pt-2">
          <p className="text-texto-corpo">
            {booking.itemTitle} · <strong className="text-verde">{formatRange(booking.startDate, booking.endDate, lang)}</strong> · {booking.renterName}
          </p>
          {sheet === "decline" && (
            <ChipGroup label={t.reason} value={reason} onChange={setReason} options={t.declineReasons.map((r) => ({ value: r, label: r }))} />
          )}
          <TextArea
            label={sheet === "accept" ? t.noteAccept : t.noteDecline}
            value={note}
            onChange={setNote}
            rows={3}
            maxLength={500}
            placeholder={sheet === "accept" ? t.noteAcceptPh : t.noteDeclinePh}
          />
        </div>
      </Sheet>
    </>
  );
}

/** Cartão de pedido recebido (v4): quem pede, prazo, equipamento, mensagem e "Recebes X Kz". */
export function RequestCard({ booking, onChange, index = 0 }: { booking: Booking; onChange: (b: Booking) => void; index?: number }) {
  const days = daysBetween(booking.startDate, booking.endDate);
  const deadline = deadlineOf(booking);
  const dict = useT();
  const lang = useLang();
  return (
    // minmax(0,1fr): sem isto a coluna da grelha cresce com o conteúdo e o cartão transborda a 360px
    <Card className="grid animate-sobe grid-cols-[minmax(0,1fr)] gap-3 p-4" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      {/* flex-wrap: a 360px o prazo ("Urgente · Faltam…") passa para a linha seguinte em vez de esmagar o nome */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">
          <Avatar name={booking.renterName} />
          <div className="min-w-0">
            <p className="truncate font-bold text-verde">{booking.renterName}</p>
            <p className="num text-[13px] text-cinza">{bookingCode(booking.id)}</p>
          </div>
        </div>
        {deadline && <DeadlineChip until={deadline} />}
      </div>
      <Link
        href={`/reservas/${booking.id}`}
        className="group flex items-center gap-3 rounded-campo border border-borda bg-areia p-2 transition-colors duration-200 hover:border-borda-forte"
      >
        <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-16 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-titulo text-lg leading-tight font-bold text-verde">{booking.itemTitle}</p>
          <p className="text-sm text-cinza">
            {formatRange(booking.startDate, booking.endDate, lang)} · {plural(days, dict.common.days)}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-cinza transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.8} aria-hidden />
      </Link>
      {booking.renterMessage && <p className="line-clamp-3 text-sm whitespace-pre-line italic">“{booking.renterMessage}”</p>}
      <div className="flex items-center justify-between rounded-campo bg-salvia-tint px-3 py-2.5">
        <span className="font-medium text-verde-medio">{dict.requests.youGet}</span>
        <Kz value={booking.totalPrice} className="text-xl text-verde" />
      </div>
      {booking.status === "PENDING_OWNER" && <RequestActions booking={booking} onDone={onChange} compact />}
    </Card>
  );
}
