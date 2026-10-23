"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { BookingRow } from "@/components/bz/booking";
import { RequestCard } from "@/components/bz/requests";
import { PageHeader } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { ButtonLink } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Tab = "pending" | "ongoing" | "past";

export default function PedidosPage() {
  const session = useRequireSession();
  const [tab, setTab] = useState<Tab>("pending");
  const { data, error, loading, reload, setData } = useResource(session ? "bookings:owner" : null, () => bookingApi.received());

  if (!session) return null;
  const all = data?.content ?? [];
  const groups: Record<Tab, Booking[]> = {
    pending: all.filter((b) => b.status === "PENDING_OWNER"),
    ongoing: all.filter((b) => ["ACCEPTED", "ACTIVE", "DISPUTED"].includes(b.status)),
    past: all.filter((b) => ["COMPLETED", "CANCELLED_OWNER", "CANCELLED_RENTER"].includes(b.status)),
  };
  const list = groups[tab];
  const replace = (b: Booking) => data && setData({ ...data, content: all.map((x) => (x.id === b.id ? b : x)) });

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <PageHeader title="Pedidos recebidos" subtitle="Responde em 24 h. Quem responde depressa aluga mais." />
      <Segmented
        label="Pedidos"
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "A responder", count: groups.pending.length },
          { value: "ongoing", label: "Em curso", count: groups.ongoing.length },
          { value: "past", label: "Histórico" },
        ]}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "pending" ? "Nenhum pedido à espera" : tab === "ongoing" ? "Nada em curso" : "Sem histórico ainda"}
          text={tab === "pending" ? "Quando alguém pedir o teu equipamento, avisamos-te e aparece aqui." : "Os alugueres aparecem aqui à medida que avançam."}
          action={<ButtonLink href="/equipamentos" variant="outline">Ver o meu equipamento</ButtonLink>}
        />
      ) : tab === "pending" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((b, i) => (
            <RequestCard key={b.id} booking={b} index={i} onChange={replace} />
          ))}
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((b, i) => (
            <li key={b.id}>
              <BookingRow booking={b} as="owner" index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
