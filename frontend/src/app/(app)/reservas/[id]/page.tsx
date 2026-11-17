"use client";

import { useServiceFeeRate } from "@/lib/fee";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardCheck, FileDown, FileText, Flag, HandCoins, MessageCircle, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";
import { BookingTicket, NextStepCard, PriceSummary, SuccessBurst, Timeline } from "@/components/bz/booking";
import { HexTile } from "@/components/bz/hex";
import { Sheet, toast } from "@/components/bz/overlay";
import { RequestActions } from "@/components/bz/requests";
import { TextArea } from "@/components/bz/form";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, Card, Eyebrow, SectionTitle, Skeleton } from "@/components/bz/ui";
import { ApiError, bookingApi, documentApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { PAID_STATUSES, bookingCode, deadlineOf, firstName, nextStep, whatsappLink } from "@/lib/booking";
import { daysBetween, formatRange } from "@/lib/format";
import type { Booking, Payment } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

function ReservaHub() {
  const feeRate = useServiceFeeRate(); // PAYMENTS_SERVICE_FEE_RATE, via API
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("novo") === "1";
  const { data: booking, error, reload, setData: setBooking } = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const as = booking && session && booking.ownerId === session.profileId ? "owner" : "renter";
  const needsPayment = booking?.status === "ACCEPTED" && as === "renter";
  const payment = useResource<Payment | null>(needsPayment ? `payment:${id}` : null, () =>
    paymentApi.current(id).then(
      (p) => p ?? null,
      (e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)),
    ),
  );
  const [cancelSheet, setCancelSheet] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const lang = useLang();
  const dict = useT();
  const t = dict.bookingHub;
  const A = t.actions;

  if (!session) return null;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!booking) {
    return (
      <div role="status" aria-label={dict.common.loading} className="mx-auto grid max-w-5xl gap-4">
        <Skeleton className="h-56 rounded-sheet" />
        <Skeleton className="h-40 rounded-sheet" />
      </div>
    );
  }

  const days = daysBetween(booking.startDate, booking.endDate);
  const pricePerDay = days ? Number(booking.totalPrice) / days : 0;
  const step = nextStep(booking, as, dict);
  const total = Math.round(Number(booking.totalPrice) * (1 + feeRate) + Number(booking.depositAmount));
  const code = bookingCode(booking.id);
  const waText = fmt(t.waText, { code, title: booking.itemTitle, range: formatRange(booking.startDate, booking.endDate, lang) });

  async function cancel() {
    setCancelling(true);
    try {
      setBooking(await bookingApi.cancel(booking!.id, cancelNote.trim() || undefined));
      toast.success(booking!.status === "ACCEPTED" ? t.bookingCancelled : t.requestCancelled);
      setCancelSheet(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.cancelError);
    } finally {
      setCancelling(false);
    }
  }

  const paid = PAID_STATUSES.includes(booking.status);
  const handover = booking.status === "ACTIVE" || booking.status === "IN_PROGRESS" || booking.status === "RETURNED";
  const hasContract = booking.status === "ACCEPTED" || paid;

  async function downloadContract() {
    try {
      await documentApi.contract(booking!.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.contractError);
    }
  }

  async function downloadReceipt() {
    try {
      const p = await paymentApi.current(booking!.id);
      if (!p?.receiptNumber) {
        toast.error(t.receiptPending);
        return;
      }
      await documentApi.receipt(p.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.receiptError);
    }
  }

  const actions: { icon: LucideIcon; label: string; href?: string; external?: boolean; show: boolean; onClick?: () => void; danger?: boolean }[] = [
    { icon: MessageCircle, label: A.whatsapp, href: whatsappLink(waText), external: true, show: true },
    { icon: ClipboardCheck, label: A.checklist, href: `/reservas/${id}/checklist`, show: handover || booking.status === "COMPLETED" || booking.status === "DISPUTED" },
    { icon: FileText, label: A.contract, href: `/reservas/${id}/contrato`, show: hasContract },
    { icon: FileDown, label: A.contractPdf, show: hasContract, onClick: downloadContract },
    { icon: Receipt, label: A.receiptPdf, show: paid, onClick: downloadReceipt },
    { icon: ShieldCheck, label: A.deposit, href: `/reservas/${id}/caucao`, show: booking.status === "RETURNED" && as === "owner" },
    { icon: HandCoins, label: as === "owner" ? A.confirmPayment : A.howToPay, href: `/reservas/${id}/pagar`, show: booking.status === "ACCEPTED" },
    // a API só aceita em COMPLETED nos 7 dias depois de o dono registar a caução
    { icon: Flag, label: A.report, href: `/reservas/${id}/problema`, show: handover || (booking.status === "COMPLETED" && as === "renter"), danger: true },
    // Até pagar não há dinheiro a devolver: o arrendatário cancela o pedido ou a reserva aceite; o dono cancela a aceite (ex.: não apareceu)
    { icon: Flag, label: booking.status === "ACCEPTED" ? A.cancelBooking : A.cancelRequest, show: (booking.status === "PENDING_OWNER" && as === "renter") || booking.status === "ACCEPTED", onClick: () => setCancelSheet(true), danger: true },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <BackLink href={as === "owner" ? "/pedidos" : "/reservas"}>{as === "owner" ? t.backOwner : t.backRenter}</BackLink>

      {isNew && booking.status === "PENDING_OWNER" && (
        <SuccessBurst title={t.sentTitle} text={fmt(t.sentText, { owner: firstName(booking.ownerName, dict) })} />
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-start">
        <div className="grid gap-5">
          <NextStepCard
            step={step}
            deadline={deadlineOf(booking, payment.data)}
            amount={needsPayment ? (payment.data?.amount ?? total) : undefined}
            positive={booking.status === "COMPLETED"}
          />
          <BookingTicket booking={booking} as={as} />
          {as === "owner" && booking.status === "PENDING_OWNER" && <RequestActions booking={booking} onDone={setBooking} />}

          {(booking.renterMessage || booking.ownerNote) && (
            <Card className="grid gap-4 p-4 md:p-5">
              {booking.renterMessage && (
                <div>
                  <Eyebrow>{fmt(t.messageFrom, { name: firstName(booking.renterName, dict) })}</Eyebrow>
                  <p className="mt-1 whitespace-pre-line">{booking.renterMessage}</p>
                </div>
              )}
              {booking.ownerNote && (
                <div>
                  <Eyebrow>{fmt(t.noteFrom, { name: firstName(booking.ownerName, dict) })}</Eyebrow>
                  <p className="mt-1 whitespace-pre-line">{booking.ownerNote}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="grid gap-5">
          <Card className="p-5">
            <SectionTitle className="mb-4">{t.progress}</SectionTitle>
            <Timeline booking={booking} />
          </Card>
          <Card className="p-5">
            <SectionTitle className="mb-4">{t.amounts}</SectionTitle>
            <PriceSummary pricePerDay={pricePerDay} days={days} deposit={Number(booking.depositAmount)} as={as} />
          </Card>
          <Card aria-label={t.actionsLabel} role="group" className="overflow-hidden">
            {actions
              .filter((a) => a.show)
              .map(({ icon: Icon, label, href, external, onClick, danger }) => {
                const cls = `group flex min-h-14 w-full items-center gap-3 border-b border-borda px-4 py-2 text-left font-medium transition-colors duration-200 last:border-0 hover:bg-areia ${danger ? "text-erro" : "text-verde"}`;
                const inner = (
                  <>
                    <HexTile icon={Icon} tone={danger ? "erro" : "areia"} size={34} />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="size-5 text-cinza transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.8} aria-hidden />
                  </>
                );
                return href ? (
                  <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls}>
                    {inner}
                  </a>
                ) : (
                  <button key={label} type="button" onClick={onClick} className={cls}>
                    {inner}
                  </button>
                );
              })}
          </Card>
        </div>
      </div>

      <Sheet
        open={cancelSheet}
        onClose={() => setCancelSheet(false)}
        title={booking.status === "ACCEPTED" ? t.cancelBookingQ : t.cancelRequestQ}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setCancelSheet(false)}>
              {t.keep}
            </Button>
            <Button variant="danger" block loading={cancelling} onClick={cancel}>
              {t.confirmCancel}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 pt-2">
          <p>
            {as === "owner"
              ? fmt(t.cancelOwnerText, { renter: firstName(booking.renterName, dict) })
              : booking.status === "ACCEPTED"
                ? t.cancelAcceptedText
                : t.cancelPendingText}
          </p>
          {as === "owner" && (
            <TextArea label={t.cancelNote} value={cancelNote} onChange={setCancelNote} maxLength={500} />
          )}
        </div>
      </Sheet>
    </div>
  );
}

export default function ReservaPage() {
  return (
    <Suspense>
      <ReservaHub />
    </Suspense>
  );
}
