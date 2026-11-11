"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { FileDown, Flag, ScrollText, ShieldCheck } from "lucide-react";
import { AdminHeader, BookingEvidence, BookingStatusBadge } from "@/components/bz/admin";
import { Timeline } from "@/components/bz/booking";
import { VerifiedBadge } from "@/components/bz/equipment";
import { toast } from "@/components/bz/overlay";
import { ErrorState, ListSkeleton } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Card, Kz, Skeleton } from "@/components/bz/ui";
import { ApiError, adminApi, bookingApi, documentApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import { daysBetween, formatDateTime, formatRange } from "@/lib/format";
import type { AuditLog, Booking, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const HAS_CONTRACT = ["ACCEPTED", "ACTIVE", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED"];

/** Reserva vista pela equipa: estado, partes, valores, provas e o rasto de auditoria. */
export default function AdminReserva() {
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(`booking:${id}`, () => bookingApi.get(id));
  const audit = useResource<Page<AuditLog>>(`audit:booking:${id}`, () => adminApi.auditLogs({ entityId: id }));
  const [downloading, setDownloading] = useState(false);

  if (booking.error) {
    const notFound = booking.error.includes("não encontrad");
    return <ErrorState message={notFound ? "Esta reserva não existe." : booking.error} onRetry={notFound ? undefined : booking.reload} />;
  }
  if (!booking.data) return <Skeleton role="status" aria-label="A carregar" className="h-96 max-w-5xl rounded-sheet" />;
  const b = booking.data;
  const days = daysBetween(b.startDate, b.endDate);

  async function contract() {
    setDownloading(true);
    try {
      await documentApi.contract(id); // fica na auditoria (CONTRACT_VIEWED)
      audit.reload();
    } catch (e) {
      toast.error(e instanceof ApiError || e instanceof Error ? e.message : "Não foi possível descarregar.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid max-w-6xl gap-6">
      <BackLink href="/admin">Visão geral</BackLink>
      <AdminHeader
        title={b.itemTitle}
        text={`Reserva ${bookingCode(b.id)} · ${formatRange(b.startDate, b.endDate)} (${days} ${days === 1 ? "dia" : "dias"})`}
        action={
          <div className="flex flex-wrap gap-2">
            {HAS_CONTRACT.includes(b.status) && (
              <Button variant="outline" size="sm" loading={downloading} onClick={contract}>
                <FileDown strokeWidth={1.8} /> Contrato (PDF)
              </Button>
            )}
            {(b.status === "RETURNED" || b.status === "DISPUTED") && (
              <ButtonLink href={`/admin/caucoes?booking=${b.id}`} variant="dark" size="sm">
                <ShieldCheck strokeWidth={1.8} /> Decidir caução
              </ButtonLink>
            )}
            {b.status === "DISPUTED" && (
              <ButtonLink href="/admin/problemas" variant="outline" size="sm">
                <Flag strokeWidth={1.8} /> Problemas
              </ButtonLink>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="grid gap-5">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Party label="Arrendatário" name={b.renterName} verified={b.renterVerified} id={b.renterId} />
            <Party label="Dono" name={b.ownerName} verified={b.ownerVerified} id={b.ownerId} />
            <div>
              <p className="text-[13px] text-cinza">Estado</p>
              <BookingStatusBadge status={b.status} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[13px] text-cinza">Aluguer</p>
                <Kz value={b.totalPrice} className="text-lg text-verde" />
              </div>
              <div>
                <p className="text-[13px] text-cinza">Caução</p>
                <Kz value={b.depositAmount} className="text-lg text-verde" />
              </div>
            </div>
            {(b.renterMessage || b.ownerNote) && (
              <div className="grid gap-2 sm:col-span-2">
                {b.renterMessage && <p className="text-[15px]"><span className="text-cinza">Mensagem do arrendatário:</span> {b.renterMessage}</p>}
                {b.ownerNote && <p className="text-[15px]"><span className="text-cinza">Nota do dono:</span> {b.ownerNote}</p>}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <BookingEvidence bookingId={b.id} />
          </Card>
        </div>

        <div className="grid gap-5">
          <Card className="p-5">
            <h2 className="mb-4 font-titulo text-lg font-bold text-verde">Progresso</h2>
            <Timeline booking={b} />
          </Card>
          <Card className="grid gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-titulo text-lg font-bold text-verde">Auditoria</h2>
              <Link href={`/admin/auditoria?entityId=${b.id}`} className="text-sm font-medium text-mel-texto hover:underline">
                Ver tudo
              </Link>
            </div>
            {audit.error ? (
              <ErrorState message={audit.error} onRetry={audit.reload} className="py-4" />
            ) : !audit.data ? (
              <ListSkeleton rows={3} />
            ) : audit.data.content.length === 0 ? (
              <p className="text-sm text-cinza">Ainda sem registos.</p>
            ) : (
              <ol className="grid gap-3">
                {audit.data.content.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <ScrollText className="mt-0.5 size-4 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                    <div className="min-w-0 text-[15px]">
                      <p className="font-medium text-verde">{AUDIT_SHORT[a.action] ?? a.action}</p>
                      <p className="text-[13px] text-cinza">{a.actorName} · {formatDateTime(a.createdAt)}</p>
                      {a.reason && <p className="text-[13px]">{a.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const AUDIT_SHORT: Record<string, string> = {
  CONTRACT_ACCEPTED: "Contrato aceite",
  CONTRACT_VIEWED: "Contrato aberto por admin",
  RECEIPT_VIEWED: "Comprovativo aberto por admin",
  PAYMENT_CONFIRMED_MANUALLY: "Pagamento validado à mão",
  HANDOVER_REGISTERED: "Entrega/devolução registada",
  HANDOVER_CONFIRMED: "Entrega/devolução confirmada",
  DEPOSIT_RELEASED: "Caução libertada",
  DEPOSIT_WITHHELD: "Caução retida",
  BOOKING_COMPLETED: "Reserva concluída",
};

function Party({ label, name, verified, id }: { label: string; name: string; verified: boolean; id: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-cinza">{label}</p>
      <p className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/auditoria?actorId=${id}&actorName=${encodeURIComponent(name)}`} className="truncate font-bold text-verde hover:underline">
          {name}
        </Link>
        {verified ? <VerifiedBadge compact /> : <span className="text-[13px] text-cinza">sem KYC aprovado</span>}
      </p>
    </div>
  );
}
