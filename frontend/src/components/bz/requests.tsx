"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { DeadlineChip } from "./booking";
import { Avatar, ItemPhoto } from "./equipment";
import { ChipGroup, TextArea } from "./form";
import { Sheet, toast } from "./overlay";
import { Button, Card, Kz } from "./ui";
import { bookingApi } from "@/lib/api";
import { bookingCode, deadlineOf, firstName } from "@/lib/booking";
import { daysBetween, formatRange } from "@/lib/format";
import type { Booking } from "@/lib/types";

const DECLINE_REASONS = ["Já está alugado nessas datas", "Equipamento em manutenção", "Não consigo fazer a entrega", "Outro motivo"];

/** Aceitar / Recusar um pedido (dono). Recusar pede motivo em chips. */
export function RequestActions({ booking, onDone, compact }: { booking: Booking; onDone: (b: Booking) => void; compact?: boolean }) {
  const [sheet, setSheet] = useState<"accept" | "decline" | null>(null);
  const [reason, setReason] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const ownerNote = [sheet === "decline" ? reason : undefined, note.trim()].filter(Boolean).join(" — ") || undefined;
      const updated = sheet === "accept" ? await bookingApi.accept(booking.id, ownerNote) : await bookingApi.cancel(booking.id, ownerNote);
      toast.success(sheet === "accept" ? `Aceite. Avisamos ${firstName(booking.renterName)} para pagar.` : "Pedido recusado. As datas ficaram livres.");
      setSheet(null);
      onDone(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={compact ? "grid grid-cols-2 gap-2" : "grid gap-2 sm:grid-cols-2"}>
        <Button variant="danger" onClick={() => setSheet("decline")}>
          <X strokeWidth={2} /> Recusar
        </Button>
        <Button onClick={() => setSheet("accept")}>
          <Check strokeWidth={2.2} /> Aceitar
        </Button>
      </div>
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === "accept" ? "Aceitar pedido" : "Recusar pedido"}
        footer={
          <Button block size="lg" variant={sheet === "accept" ? "primary" : "dark"} loading={busy} onClick={run} disabled={sheet === "decline" && !reason}>
            {sheet === "accept" ? "Aceitar e bloquear datas" : "Recusar pedido"}
          </Button>
        }
      >
        <div className="grid gap-4 pt-2">
          <p className="text-texto-corpo">
            {booking.itemTitle} · <strong className="text-verde">{formatRange(booking.startDate, booking.endDate)}</strong> · {booking.renterName}
          </p>
          {sheet === "decline" && (
            <ChipGroup label="Motivo" value={reason} onChange={setReason} options={DECLINE_REASONS.map((r) => ({ value: r, label: r }))} />
          )}
          <TextArea
            label={sheet === "accept" ? "Nota para o arrendatário (opcional)" : "Mensagem (opcional)"}
            value={note}
            onChange={setNote}
            rows={3}
            maxLength={500}
            placeholder={sheet === "accept" ? "Ex.: levanta em Talatona, perto do Belas Shopping." : "Ex.: tenho livre a partir de dia 20."}
          />
        </div>
      </Sheet>
    </>
  );
}

/** Cartão de pedido recebido, com prazo e "Recebes X Kz". */
export function RequestCard({ booking, onChange, index = 0 }: { booking: Booking; onChange: (b: Booking) => void; index?: number }) {
  const days = daysBetween(booking.startDate, booking.endDate);
  const deadline = deadlineOf(booking);
  return (
    <Card className="grid animate-sobe gap-4 p-4" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={booking.renterName} />
          <div className="min-w-0">
            <p className="truncate font-bold text-verde">{booking.renterName}</p>
            <p className="num text-[13px] text-cinza">{bookingCode(booking.id)}</p>
          </div>
        </div>
        {deadline && <DeadlineChip until={deadline} />}
      </div>
      <Link href={`/reservas/${booking.id}`} className="flex items-center gap-3 rounded-campo bg-areia p-2 hover:bg-areia-2">
        <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-16 shrink-0 rounded-[10px]" />
        <div className="min-w-0">
          <p className="truncate font-titulo font-bold text-verde">{booking.itemTitle}</p>
          <p className="text-sm text-cinza">
            {formatRange(booking.startDate, booking.endDate)} · {days} {days === 1 ? "dia" : "dias"}
          </p>
        </div>
      </Link>
      {booking.renterMessage && <p className="line-clamp-3 rounded-campo border-l-4 border-salvia bg-salvia-tint/40 px-3 py-2 text-sm whitespace-pre-line">{booking.renterMessage}</p>}
      <div className="flex items-end justify-between">
        <span className="text-sm text-cinza">Recebes</span>
        <Kz value={booking.totalPrice} className="text-2xl text-verde" />
      </div>
      {booking.status === "PENDING_OWNER" && <RequestActions booking={booking} onDone={onChange} compact />}
    </Card>
  );
}
