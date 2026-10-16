"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemPhoto } from "@/components/beeznoo/booking-ui";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/beeznoo/states";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { ACTIVE_STATUSES, BOOKING_STATUS, formatKz, formatRange } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

export default function ReservasPage() {
  const session = useRequireSession();
  const [tab, setTab] = useState<"ativas" | "passadas">("ativas");
  const { data: bookings, error, reload } = useResource(session ? "my-bookings" : null, () =>
    bookingApi.mine().then((p) => p.content),
  );

  if (!session) return null;

  const list = (bookings ?? []).filter((b) => ACTIVE_STATUSES.includes(b.status) === (tab === "ativas"));

  return (
    <div className="grid gap-5">
      <h1 className="font-heading text-[26px] text-verde md:text-[32px]">As minhas reservas</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid h-11 w-full max-w-sm grid-cols-2 rounded-bz-sm bg-areia-2 p-1">
          <TabsTrigger value="ativas" className="rounded-bz-sm text-[15px] data-[state=active]:bg-branco data-[state=active]:text-verde">Ativas</TabsTrigger>
          <TabsTrigger value="passadas" className="rounded-bz-sm text-[15px] data-[state=active]:bg-branco data-[state=active]:text-verde">Passadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !bookings ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={tab === "ativas" ? "Ainda não tens reservas" : "Sem reservas passadas"}
          text={tab === "ativas" ? "Encontra o equipamento de que precisas e faz o teu primeiro pedido." : "As reservas concluídas ou canceladas aparecem aqui."}
          action={<Button asChild variant="outline"><Link href="/explorar">Explorar equipamento</Link></Button>}
        />
      ) : (
        <ul className="grid gap-3">
          {list.map((b) => {
            const st = BOOKING_STATUS[b.status];
            return (
              <li key={b.id}>
                <Link
                  href={`/reservas/${b.id}`}
                  className="flex gap-3 rounded-bz-md border border-borda bg-branco p-3 hover:border-borda-forte focus-visible:ring-[3px] focus-visible:ring-verde-medio/30 focus-visible:outline-none"
                >
                  <ItemPhoto src={b.itemCoverPhoto} alt={b.itemTitle} className="w-24 shrink-0 rounded-bz-sm" />
                  <div className="grid min-w-0 content-start gap-1">
                    <p className="truncate font-heading text-base text-verde md:text-lg">{b.itemTitle}</p>
                    <p className="text-sm text-cinza">{formatRange(b.startDate, b.endDate)} · {formatKz(b.totalPrice)}</p>
                    <Badge variant={st.badge}>{st.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
