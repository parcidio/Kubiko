"use client";

import Link from "next/link";
import { ArrowUpRight, CreditCard, Inbox, Package, Plus, Radio, Ticket } from "lucide-react";
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
    <div className="grid gap-8 px-4 md:gap-7 md:px-12">
      <section className="hero-explore relative -mx-4 -mt-5 flex min-h-[calc(78svh-4rem)] items-center overflow-hidden bg-verde-noite px-4 pt-20 pb-10 text-areia md:-mx-12 md:-mt-8 md:min-h-[calc(78svh-5rem)] md:rounded-none md:px-12 md:py-16">
        <HexGlow />
        <div className="relative grid gap-6">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="text-salvia">O teu negócio na Beeznoo</Eyebrow>
            <ModeSwitch dark className="md:hidden" />
          </div>
          <div className="grid gap-3 md:max-w-xl">
            <div className="relative grid min-h-64 gap-8 overflow-hidden rounded-sheet border border-white/15 bg-linear-to-br from-verde-medio via-verde to-verde-noite p-6 text-areia shadow-flutua md:min-h-72 md:p-8">
              <div className="absolute -top-20 -right-16 size-56 rounded-full bg-ambar/15 blur-3xl" aria-hidden />
              <div className="relative flex items-start justify-between">
                <div className="grid gap-1">
                  <p className="text-xs font-bold tracking-[0.16em] text-areia/65 uppercase">Beeznoo Pay</p>
                  <p className="font-titulo text-lg font-bold">Cartão de débito</p>
                </div>
                <CreditCard className="size-7 text-ambar" strokeWidth={1.6} aria-hidden />
              </div>
              <div className="relative flex items-center gap-3">
                <span className="flex h-9 w-12 items-center justify-center rounded-md border border-ambar/60 bg-ambar/20">
                  <span className="h-5 w-7 rounded-sm border border-ambar/70" aria-hidden />
                </span>
                <Radio className="size-5 rotate-90 text-areia/70" strokeWidth={1.5} aria-hidden />
              </div>
              <div className="relative grid gap-1">
                <p className="num text-lg tracking-[0.18em] text-areia/85">••••  ••••  ••••  {account.data?.availableBalance ? "2048" : "0000"}</p>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.14em] text-areia/55 uppercase">Saldo disponível</p>
                    {account.loading ? <Skeleton className="mt-1 h-8 w-40 bg-white/10" /> : <Kz value={account.data?.availableBalance ?? 0} className="text-3xl leading-none text-ambar" />}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-areia/55 uppercase">Titular</p>
                    <p className="text-sm font-bold">Beeznoo member</p>
                  </div>
                </div>
              </div>
            </div>
            <Link href="/carteira" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-areia hover:underline">
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
