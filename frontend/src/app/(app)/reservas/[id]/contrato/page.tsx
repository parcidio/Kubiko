"use client";

import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/bz/shell";
import { BackendPending, ErrorState } from "@/components/bz/states";
import { BackLink, Card, Kz, Skeleton } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode } from "@/lib/booking";
import { daysBetween, formatRange } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/** Pré-visualização do contrato com os dados da reserva. O texto legal final é do PM/jurídico. */
export default function ContratoPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));

  if (!session) return null;
  if (booking.error) return <ErrorState message={booking.error} onRetry={booking.reload} />;
  if (!booking.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  const b = booking.data;
  const days = daysBetween(b.startDate, b.endDate);

  const clauses = [
    `${b.ownerName} ("Dono") cede a ${b.renterName} ("Arrendatário") o uso de ${b.itemTitle}, de ${formatRange(b.startDate, b.endDate)} (${days} ${days === 1 ? "dia" : "dias"}).`,
    "O Arrendatário devolve o equipamento na data combinada, no mesmo estado em que o recebeu, com todos os acessórios.",
    "Na entrega e na devolução, as partes fazem a checklist com fotos na app. As fotos servem de prova do estado.",
    `A caução de ${Math.round(Number(b.depositAmount)).toLocaleString("de-DE")} Kz fica retida pela Beeznoo e é devolvida depois da inspeção, se não houver dano.`,
    "Em caso de dano, perda ou roubo, o Arrendatário reporta o problema na app. A equipa Beeznoo decide a retenção total ou parcial da caução.",
    "Atrasos na devolução podem ser cobrados ao valor diário em vigor.",
  ];

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      <PageHeader title="Contrato de aluguer" subtitle="Resumo do que as duas partes aceitam." />
      <BackendPending what="Contratos (versão do texto + aceitação de cada parte) não têm endpoint. Texto provisório, a validar pelo PM." />
      <Card className="grid gap-5 p-6">
        <div className="flex items-center gap-3">
          <FileText className="size-6 text-mel" strokeWidth={1.8} aria-hidden />
          <div>
            <p className="num font-bold text-verde">{bookingCode(b.id)}</p>
            <p className="text-[13px] text-cinza">Valor do aluguer: <Kz value={b.totalPrice} className="text-[13px]" /></p>
          </div>
        </div>
        <ol className="grid list-decimal gap-3 pl-5 marker:font-bold marker:text-verde">
          {clauses.map((c) => (
            <li key={c} className="pl-1">{c}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
