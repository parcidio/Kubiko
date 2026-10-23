"use client";

import { Bell } from "lucide-react";
import { BookingRow } from "@/components/bz/booking";
import { PageHeader } from "@/components/bz/shell";
import { BackendPending, EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { ButtonLink } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { useResource } from "@/lib/use-resource";

/** Enquanto não há notificações no backend, a atividade mostra as reservas mexidas mais recentemente. */
export default function AtividadePage() {
  const session = useRequireSession();
  const { data, error, loading, reload } = useResource(session ? "bookings:renter" : null, () => bookingApi.mine());

  if (!session) return null;
  const recent = [...(data?.content ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="Atividade" subtitle="O que mudou nas tuas reservas." />
      <BackendPending what="Notificações (pedido aceite, pagamento validado…) não têm endpoint. Mostramos as últimas reservas atualizadas." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : recent.length === 0 ? (
        <EmptyState icon={Bell} title="Tudo calmo" text="Quando houver novidades nas tuas reservas, aparecem aqui." action={<ButtonLink href="/explorar">Explorar</ButtonLink>} />
      ) : (
        <ul className="grid gap-3">
          {recent.map((b, i) => (
            <li key={b.id}>
              <BookingRow booking={b} as="renter" index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
