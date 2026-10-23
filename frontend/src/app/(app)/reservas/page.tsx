"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { BookingRow } from "@/components/bz/booking";
import { PageHeader } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { ButtonLink } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/booking";
import { useResource } from "@/lib/use-resource";

export default function ReservasPage() {
  const session = useRequireSession();
  const [tab, setTab] = useState<"open" | "past">("open");
  const { data, error, loading, reload } = useResource(session ? "bookings:renter" : null, () => bookingApi.mine());

  if (!session) return null;
  const all = data?.content ?? [];
  const open = all.filter((b) => OPEN_STATUSES.includes(b.status));
  const past = all.filter((b) => !OPEN_STATUSES.includes(b.status));
  const list = tab === "open" ? open : past;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="As minhas reservas" subtitle="Tudo o que pediste, num só sítio." />
      <Segmented
        label="Reservas"
        value={tab}
        onChange={setTab}
        options={[
          { value: "open", label: "Ativas", count: open.length },
          { value: "past", label: "Passadas" },
        ]}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={tab === "open" ? "Ainda sem reservas ativas" : "Nada no histórico"}
          text={tab === "open" ? "Encontra o equipamento para o teu próximo trabalho e pede as datas." : "Os alugueres concluídos e cancelados aparecem aqui."}
          action={<ButtonLink href="/explorar">Explorar equipamento</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3">
          {list.map((b, i) => (
            <li key={b.id}>
              <BookingRow booking={b} as="renter" index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
