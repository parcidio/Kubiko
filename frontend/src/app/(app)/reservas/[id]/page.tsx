"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemPhoto, PriceSummary, Timeline } from "@/components/beeznoo/booking-ui";
import { PaymentPanel } from "@/components/beeznoo/payment-panel";
import { ErrorState } from "@/components/beeznoo/states";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { BOOKING_STATUS, daysBetween, formatRange } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

function ReservaDetail() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("novo") === "1";
  const { data: booking, error, reload, setData: setBooking } = useResource<Booking>(
    session ? `booking:${id}` : null,
    () => bookingApi.get(id),
  );
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!session) return null;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!booking) return <Skeleton role="status" aria-label="A carregar" className="h-96" />;

  const st = BOOKING_STATUS[booking.status];
  const days = daysBetween(booking.startDate, booking.endDate);
  // O backend só deixa o arrendatário cancelar antes de o dono responder
  const canCancel = booking.status === "PENDING_OWNER";

  async function cancel() {
    setCancelling(true);
    try {
      setBooking(await bookingApi.cancel(booking!.id));
      toast.success("Reserva cancelada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Link href="/reservas" className="flex items-center gap-1 text-sm text-mel-texto hover:underline">
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> As minhas reservas
      </Link>

      {isNew && booking.status === "PENDING_OWNER" && (
        <Alert variant="ok">
          <CheckCircle2 strokeWidth={1.8} />
          <AlertDescription className="text-current">Pedido enviado a {booking.ownerName}. Avisamos-te por SMS quando responder.</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <ItemPhoto src={booking.itemCoverPhoto} alt={booking.itemTitle} className="w-28 shrink-0 rounded-bz-md border border-borda" />
        <div className="grid content-start gap-1">
          <h1 className="font-heading text-[22px] leading-tight text-verde md:text-[26px]">{booking.itemTitle}</h1>
          <p className="text-cinza">{formatRange(booking.startDate, booking.endDate)} · {booking.ownerName}</p>
          <Badge variant={st.badge}>{st.label}</Badge>
        </div>
      </div>

      {booking.status === "PENDING_OWNER" && (
        <div className="flex gap-3 rounded-bz-md bg-ambar-tint p-3 text-sm text-aviso-texto">
          <Clock className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
          <p>O dono tem 24 h para responder. Ainda não precisas de pagar nada.</p>
        </div>
      )}

      {booking.status === "ACCEPTED" && <PaymentPanel booking={booking} onPaid={reload} />}

      {booking.ownerNote && (
        <div className="rounded-bz-md bg-areia-2 p-3 text-sm text-verde">
          <p className="text-xs tracking-[0.1em] text-cinza uppercase">Nota do dono</p>
          <p className="mt-1">{booking.ownerNote}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-bz-md border border-borda bg-branco p-4" aria-labelledby="t-progress">
          <h2 id="t-progress" className="mb-4 font-heading text-lg text-verde">Progresso</h2>
          <Timeline status={booking.status} />
        </section>
        <section className="rounded-bz-md border border-borda bg-branco p-4" aria-labelledby="t-values">
          <h2 id="t-values" className="mb-4 font-heading text-lg text-verde">Valores</h2>
          <PriceSummary pricePerDay={days ? Number(booking.totalPrice) / days : 0} days={days} deposit={Number(booking.depositAmount)} />
        </section>
      </div>

      {canCancel && (
        <div className="grid gap-3">
          {confirmCancel ? (
            <div className="grid gap-3 rounded-bz-md border border-erro bg-erro-tint p-4">
              <p className="text-erro">Cancelar este pedido? O dono é avisado e as datas ficam livres.</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={cancel} disabled={cancelling}>
                  {cancelling ? "A cancelar…" : "Sim, cancelar"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Manter</Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" className="justify-self-start" onClick={() => setConfirmCancel(true)}>
              Cancelar reserva
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReservaPage() {
  return (
    <Suspense>
      <ReservaDetail />
    </Suspense>
  );
}
