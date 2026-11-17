"use client";

import Link from "next/link";
import { ArrowUpRight, CreditCard, Inbox, Package, Plus, Radio, Ticket } from "lucide-react";
import { HexTile } from "@/components/bz/hex";
import { HexGlow } from "@/components/bz/brand";
import { BookingRow } from "@/components/bz/booking";
import { RequestCard } from "@/components/bz/requests";
import { ModeSwitch } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { ButtonLink, Callout, Eyebrow, Kz, SectionTitle, Skeleton } from "@/components/bz/ui";
import { bookingApi, ownerItemApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { canOwn } from "@/lib/mode";
import { useResource } from "@/lib/use-resource";
import { useT } from "@/lib/i18n/client";

export default function PainelPage() {
  const session = useRequireSession();
  const owner = !!session && canOwn(session.role);
  const received = useResource(owner ? "bookings:owner" : null, () => bookingApi.received());
  const items = useResource(owner ? "items:mine" : null, () => ownerItemApi.mine());
  // pagamento direto (2026-11-15): sem saldo na Beeznoo; o que importa é a taxa por entregar
  const commissions = useResource(owner ? "commissions:me" : null, () => paymentApi.myCommissions());
  const t = useT().dashboard;

  if (!session) return null;
  if (!owner) {
    return (
      <Callout tone="info" title={t.notOwnerTitle} action={<ButtonLink href="/explorar" variant="outline">{t.goExplore}</ButtonLink>}>
        {t.notOwnerText}
      </Callout>
    );
  }

  const all = received.data?.content ?? [];
  const pending = all.filter((b) => b.status === "PENDING_OWNER");
  const upcoming = all.filter((b) => ["ACCEPTED", "ACTIVE", "IN_PROGRESS", "RETURNED"].includes(b.status));
  const activeItems = (items.data?.content ?? []).filter((i) => i.status === "ACTIVE").length;

  return (
    <div className="grid gap-8 px-4 md:gap-7 md:px-12">
      {/* O herói sobe para trás do TopBar (-mt = pt do <main> + 4rem do cabeçalho) e o cabeçalho fica transparente
          por cima dele (HERO_ROUTES no shell.tsx); ao primeiro scroll para baixo volta ao normal */}
      <section className="hero-explore relative -mx-4 -mt-[calc(4rem+1.25rem)] flex items-center overflow-hidden rounded-b-sheet bg-verde-noite px-4 pt-[calc(4rem+2rem)] pb-8 text-areia md:-mx-12 md:-mt-[calc(4rem+2rem)] md:min-h-[calc(min(64svh,600px)+4rem)] md:rounded-none md:px-12 md:pt-[calc(4rem+3.5rem)] md:pb-14">
        <HexGlow />
        <div className="relative grid gap-6">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow className="text-salvia">{t.eyebrow}</Eyebrow>
            <ModeSwitch dark className="md:hidden" />
          </div>
          <div className="grid gap-3 md:max-w-xl">
            <div className="superficie-marca relative grid min-h-64 gap-8 overflow-hidden rounded-sheet border border-white/15 bg-linear-to-br from-verde-medio via-verde to-verde-noite p-6 text-areia shadow-flutua md:min-h-72 md:p-8">
              <div className="absolute -top-20 -right-16 size-56 rounded-full bg-ambar/15 blur-3xl" aria-hidden />
              <div className="relative flex items-start justify-between">
                <div className="grid gap-1">
                  <p className="text-xs font-bold tracking-[0.12em] text-salvia uppercase">{t.wallet}</p>
                  <p className="font-titulo text-lg font-bold text-white">{t.receiveAtHandover}</p>
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
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.08em] text-salvia-tint uppercase">{t.feeDue}</p>
                    {commissions.loading ? <Skeleton className="mt-1 h-8 w-40 bg-white/10" /> : <Kz value={commissions.data?.due ?? 0} className="mt-1 block text-3xl leading-none text-white" />}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-salvia-tint uppercase">{t.payments}</p>
                    <p className="num text-sm font-bold text-white">{commissions.data?.lines.length ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>
            <Link href="/carteira" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-salvia hover:underline">
              {t.seeWallet} <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: t.pending, value: pending.length, href: "/pedidos", icon: Inbox },
              { label: t.activeRentals, value: upcoming.length, href: "/pedidos", icon: Ticket },
              { label: t.activeItems, value: activeItems, href: "/equipamentos", icon: Package },
            ].map(({ label, value, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="group grid gap-2 rounded-cartao border border-white/10 bg-white/5 p-3 transition-colors duration-200 hover:border-salvia/40 hover:bg-white/10"
              >
                <HexTile icon={Icon} tone="salvia" size={34} flip />
                <dd className="num font-titulo text-[26px] leading-none font-bold text-white md:text-3xl">{received.loading ? "–" : value}</dd>
                <dt className="text-[13px] leading-tight text-salvia-tint">{label}</dt>
              </Link>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-4">
        <SectionTitle action={pending.length > 0 ? <Link href="/pedidos" className="inline-flex min-h-11 items-center text-sm font-bold text-mel-texto hover:underline">{t.seeAll}</Link> : null}>
          {t.answerThese}
        </SectionTitle>
        {received.error ? (
          <ErrorState message={received.error} onRetry={received.reload} />
        ) : received.loading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t.emptyTitle}
            text={t.emptyText}
            action={<ButtonLink href="/publicar" variant="dark"><Plus strokeWidth={2} /> {t.publish}</ButtonLink>}
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
          <SectionTitle>{t.upcoming}</SectionTitle>
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
