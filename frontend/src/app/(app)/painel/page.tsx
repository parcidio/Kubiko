"use client";

import Link from "next/link";
import { ArrowUpRight, Inbox, Package, Plus, Ticket } from "lucide-react";
import { HexGlow } from "@/components/bz/brand";
import { BookingRow } from "@/components/bz/booking";
import { RequestCard } from "@/components/bz/requests";
import { ModeSwitch } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { ButtonLink, Callout, Eyebrow, Kz, SectionTitle, Skeleton } from "@/components/bz/ui";
import { bookingApi, ownerItemApi, walletApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { canOwn } from "@/lib/mode";
import { useResource } from "@/lib/use-resource";

export default function PainelPage() {
  const session = useRequireSession();
  const owner = !!session && canOwn(session.role);
  const received = useResource(owner ? "bookings:owner" : null, () => bookingApi.received());
  const items = useResource(owner ? "items:mine" : null, () => ownerItemApi.mine());
  const account = useResource(owner ? "account" : null, () => walletApi.account());

  if (!session) return null;
  if (!owner) {
    return (
      <Callout tone="info" title="O painel é para donos de equipamento" action={<ButtonLink href="/explorar" variant="outline">Ir para Explorar</ButtonLink>}>
        A tua conta está como arrendatário. Para publicar equipamento fala connosco para mudar a conta para &quot;as duas coisas&quot;.
      </Callout>
    );
  }

  const all = received.data?.content ?? [];
  const pending = all.filter((b) => b.status === "PENDING_OWNER");
  const upcoming = all.filter((b) => b.status === "ACCEPTED" || b.status === "ACTIVE");
  const activeItems = (items.data?.content ?? []).filter((i) => i.status === "ACTIVE").length;

  return (
    <div className="grid gap-8">
      <section className="relative -mx-4 -mt-5 overflow-hidden bg-verde-noite px-4 pt-6 pb-7 text-areia md:mx-0 md:mt-0 md:rounded-sheet md:p-10">
        <HexGlow />
        <div className="relative grid gap-6">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="text-salvia">O teu negócio na Beeznoo</Eyebrow>
            <ModeSwitch dark className="md:hidden" />
          </div>
          <div className="grid gap-1">
            <p className="text-areia/75">Disponível na carteira</p>
            {account.loading ? (
              <Skeleton className="h-14 w-56 bg-white/10" />
            ) : (
              <Kz value={account.data?.availableBalance ?? 0} className="text-[48px] leading-none text-ambar md:text-[64px]" />
            )}
            <Link href="/carteira" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-areia hover:underline">
              Ver movimentos <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: "Pedidos à espera", value: pending.length, href: "/pedidos", icon: Inbox },
              { label: "Alugueres ativos", value: upcoming.length, href: "/pedidos", icon: Ticket },
              { label: "Equipamentos ativos", value: activeItems, href: "/equipamentos", icon: Package },
            ].map(({ label, value, href, icon: Icon }) => (
              <Link key={label} href={href} className="grid gap-2 rounded-cartao bg-white/8 p-3 transition hover:bg-white/12">
                <Icon className="size-5 text-ambar" strokeWidth={1.8} aria-hidden />
                <dd className="num font-titulo text-3xl font-extrabold">{received.loading ? "–" : value}</dd>
                <dt className="text-[13px] leading-tight text-areia/75">{label}</dt>
              </Link>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-4">
        <SectionTitle action={pending.length > 0 ? <Link href="/pedidos" className="text-sm font-bold text-mel-texto">Ver todos</Link> : null}>
          Responde a estes pedidos
        </SectionTitle>
        {received.error ? (
          <ErrorState message={received.error} onRetry={received.reload} />
        ) : received.loading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sem pedidos à espera"
            text="Quando alguém pedir o teu equipamento, aparece aqui. Mais fotos e bom preço trazem mais pedidos."
            action={<ButtonLink href="/publicar" variant="dark"><Plus strokeWidth={2} /> Publicar equipamento</ButtonLink>}
            className="py-6"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.slice(0, 4).map((b, i) => (
              <RequestCard key={b.id} booking={b} index={i} onChange={() => received.reload()} />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="grid gap-4">
          <SectionTitle>Próximas entregas e devoluções</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.map((b, i) => (
              <li key={b.id}>
                <BookingRow booking={b} as="owner" index={i} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
