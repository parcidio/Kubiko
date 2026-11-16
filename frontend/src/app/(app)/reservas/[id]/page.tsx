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

  if (!session) return null;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!booking) {
    return (
      <div role="status" aria-label="A carregar" className="mx-auto grid max-w-5xl gap-4">
        <Skeleton className="h-56 rounded-sheet" />
        <Skeleton className="h-40 rounded-sheet" />
      </div>
    );
  }

  const days = daysBetween(booking.startDate, booking.endDate);
  const pricePerDay = days ? Number(booking.totalPrice) / days : 0;
  const step = nextStep(booking, as);
  const total = Math.round(Number(booking.totalPrice) * (1 + feeRate) + Number(booking.depositAmount));
  const code = bookingCode(booking.id);
  const waText = `Olá Beeznoo! É sobre a reserva ${code}: ${booking.itemTitle}, ${formatRange(booking.startDate, booking.endDate)}.`;

  async function cancel() {
    setCancelling(true);
    try {
      setBooking(await bookingApi.cancel(booking!.id, cancelNote.trim() || undefined));
      toast.success(booking!.status === "ACCEPTED" ? "Reserva cancelada." : "Pedido cancelado.");
      setCancelSheet(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar.");
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
      toast.error(e instanceof Error ? e.message : "Não foi possível descarregar o contrato.");
    }
  }

  async function downloadReceipt() {
    try {
      const p = await paymentApi.current(booking!.id);
      if (!p?.receiptNumber) {
        toast.error("O comprovativo aparece quando o pagamento for confirmado.");
        return;
      }
      await documentApi.receipt(p.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível descarregar o comprovativo.");
    }
  }

  const actions: { icon: LucideIcon; label: string; href?: string; external?: boolean; show: boolean; onClick?: () => void; danger?: boolean }[] = [
    { icon: MessageCircle, label: "Falar com a equipa no WhatsApp", href: whatsappLink(waText), external: true, show: true },
    { icon: ClipboardCheck, label: "Checklist de entrega e devolução", href: `/reservas/${id}/checklist`, show: handover || booking.status === "COMPLETED" || booking.status === "DISPUTED" },
    { icon: FileText, label: "Contrato de aluguer", href: `/reservas/${id}/contrato`, show: hasContract },
    { icon: FileDown, label: "Descarregar contrato (PDF)", show: hasContract, onClick: downloadContract },
    { icon: Receipt, label: "Comprovativo de pagamento (PDF)", show: paid, onClick: downloadReceipt },
    { icon: ShieldCheck, label: "Registar devolução da caução", href: `/reservas/${id}/caucao`, show: booking.status === "RETURNED" && as === "owner" },
    { icon: HandCoins, label: as === "owner" ? "Confirmar que recebi o pagamento" : "Como pagar na entrega", href: `/reservas/${id}/pagar`, show: booking.status === "ACCEPTED" },
    // a API só aceita em COMPLETED nos 7 dias depois de o dono registar a caução
    { icon: Flag, label: "Reportar problema", href: `/reservas/${id}/problema`, show: handover || (booking.status === "COMPLETED" && as === "renter"), danger: true },
    // Até pagar não há dinheiro a devolver: o arrendatário cancela o pedido ou a reserva aceite; o dono cancela a aceite (ex.: não apareceu)
    { icon: Flag, label: booking.status === "ACCEPTED" ? "Cancelar reserva" : "Cancelar pedido", show: (booking.status === "PENDING_OWNER" && as === "renter") || booking.status === "ACCEPTED", onClick: () => setCancelSheet(true), danger: true },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <BackLink href={as === "owner" ? "/pedidos" : "/reservas"}>{as === "owner" ? "Pedidos recebidos" : "As minhas reservas"}</BackLink>

      {isNew && booking.status === "PENDING_OWNER" && (
        <SuccessBurst title="Pedido enviado!" text={`${firstName(booking.ownerName)} tem 24 h para responder. Avisamos-te assim que houver novidades.`} />
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
                  <Eyebrow>Mensagem de {firstName(booking.renterName)}</Eyebrow>
                  <p className="mt-1 whitespace-pre-line">{booking.renterMessage}</p>
                </div>
              )}
              {booking.ownerNote && (
                <div>
                  <Eyebrow>Nota de {firstName(booking.ownerName)}</Eyebrow>
                  <p className="mt-1 whitespace-pre-line">{booking.ownerNote}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="grid gap-5">
          <Card className="p-5">
            <SectionTitle className="mb-4">Progresso</SectionTitle>
            <Timeline booking={booking} />
          </Card>
          <Card className="p-5">
            <SectionTitle className="mb-4">Valores</SectionTitle>
            <PriceSummary pricePerDay={pricePerDay} days={days} deposit={Number(booking.depositAmount)} as={as} />
          </Card>
          <Card aria-label="Ações" role="group" className="overflow-hidden">
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
        title={booking.status === "ACCEPTED" ? "Cancelar reserva?" : "Cancelar pedido?"}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setCancelSheet(false)}>
              Manter
            </Button>
            <Button variant="danger" block loading={cancelling} onClick={cancel}>
              Sim, cancelar
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 pt-2">
          <p>
            {as === "owner"
              ? `${firstName(booking.renterName)} é avisado e as datas ficam livres. Usa isto se não apareceu ou se combinaram cancelar. Ainda não recebeste o pagamento na app.`
              : booking.status === "ACCEPTED"
                ? "O dono é avisado e as datas ficam livres. Ainda não pagaste nada na app, por isso não há reembolso a tratar."
                : "O dono é avisado e as datas ficam livres. Ainda não pagaste nada, por isso não há reembolso a tratar."}
          </p>
          {as === "owner" && (
            <TextArea label="Mensagem para o arrendatário (opcional)" value={cancelNote} onChange={setCancelNote} maxLength={500} />
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
