"use client";

import { useState } from "react";
import { Clock, Inbox, Ticket } from "lucide-react";
import { BookingRow } from "@/components/bz/booking";
import { HexTile } from "@/components/bz/hex";
import { RequestCard } from "@/components/bz/requests";
import { ErrorState, HiveEmptyState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { Tip } from "@/components/bz/tip";
import { ButtonLink } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt, plural, type Dict } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

type Tab = "pending" | "ongoing" | "past";


const HOUR = 3_600_000;

export default function PedidosPage() {
  const session = useRequireSession();
  const [tab, setTab] = useState<Tab>("pending");
  const [now] = useState(() => Date.now()); // instante fixo por visita: o render tem de ser puro
  const { data, error, loading, reload, setData } = useResource(session ? "bookings:owner" : null, () => bookingApi.received());
  const dict = useT();
  const t = dict.requests;
  const EMPTY = t.empty;

  if (!session) return null;
  const all = data?.content ?? [];
  const groups: Record<Tab, Booking[]> = {
    pending: all.filter((b) => b.status === "PENDING_OWNER"),
    ongoing: all.filter((b) => ["ACCEPTED", "ACTIVE", "IN_PROGRESS", "RETURNED", "DISPUTED"].includes(b.status)),
    past: all.filter((b) => ["COMPLETED", "CANCELLED_OWNER", "CANCELLED_RENTER", "EXPIRED"].includes(b.status)),
  };
  const list = groups[tab];
  const replace = (b: Booking) => data && setData({ ...data, content: all.map((x) => (x.id === b.id ? b : x)) });
  // O pedido mais antigo por responder decide o anel das 24 h
  const oldest = groups.pending.reduce<Booking | null>((o, b) => (!o || b.createdAt < o.createdAt ? b : o), null);
  const waitedHours = oldest ? Math.max(0, (now - new Date(oldest.createdAt).getTime()) / HOUR) : 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:gap-6">
      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        {/* Cabeçalho escuro */}
        <section className="superficie-marca relative overflow-hidden rounded-sheet bg-verde p-5 text-areia md:p-8">
          <div className="hex-bg absolute inset-0 opacity-80" aria-hidden />
          <div className="relative flex items-center gap-4">
            <HexTile icon={Inbox} size={56} className="bg-ambar text-sobre-ambar md:hidden" />
            <HexTile icon={Inbox} size={76} className="hidden bg-ambar text-sobre-ambar md:inline-flex" />
            <div className="grid min-w-0 gap-1">
              <h1 className="font-titulo text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-white md:text-[34px]">{t.title}</h1>
              <p className="text-salvia-tint">{t.subtitle}</p>
            </div>
          </div>
        </section>

        {/* Anel das 24 h + pedidos por responder */}
        <section aria-label={t.toAnswerLabel} className="flex items-center gap-4 rounded-sheet border border-ambar/30 bg-ambar-tint p-5 md:gap-5 md:p-6">
          <DeadlineRing hours={waitedHours} active={!!oldest} />
          <div className="grid min-w-0 gap-0.5">
            <p className="num font-titulo text-[34px] leading-none font-extrabold text-verde">{loading ? "–" : groups.pending.length}</p>
            <p className="font-bold text-verde">{t.toAnswer}</p>
            <p className="text-[13px] text-aviso-texto">
              {loading ? t.loading : oldest ? fmt(t.oldest, { wait: formatWait(waitedHours, dict) }) : t.none}
            </p>
          </div>
        </section>
      </div>

      <Tip id="requests" title={dict.tips.requests.title} steps={dict.tips.requests.steps} />

      <Segmented
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        counts="neutral"
        options={[
          { value: "pending", label: t.tabs.pending, count: groups.pending.length },
          { value: "ongoing", label: t.tabs.ongoing, count: groups.ongoing.length },
          { value: "past", label: t.tabs.past, count: groups.past.length },
        ]}
      />

      <div className="overflow-hidden rounded-cartao border border-borda bg-branco">
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="p-3 md:p-4"><ListSkeleton /></div>
        ) : list.length === 0 ? (
          <HiveEmptyState
            icon={Inbox}
            satellites={[Clock, Ticket]}
            title={EMPTY[tab].title}
            text={EMPTY[tab].text}
            action={<ButtonLink href="/equipamentos" variant="outline">{t.myEquipment}</ButtonLink>}
          />
        ) : tab === "pending" ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 md:grid-cols-2 md:p-4">
            {list.map((b, i) => (
              <RequestCard key={b.id} booking={b} index={i} onChange={replace} />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 md:p-4">
            {list.map((b, i) => (
              <li key={b.id}>
                <BookingRow booking={b} as="owner" index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// 0.4 → "menos de 1 h" · 5.2 → "5 h" · 30 → "1 dia"
function formatWait(h: number, t: Dict) {
  if (h < 1) return t.requests.lessThanHour;
  if (h < 24) return fmt(t.requests.hours, { n: Math.floor(h) });
  return plural(Math.floor(h / 24), t.common.days);
}

/** Anel das 24 h: enche com o tempo de espera do pedido mais antigo; o ponto âmbar marca onde vai. */
function DeadlineRing({ hours, active }: { hours: number; active: boolean }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const p = active ? Math.min(hours / 24, 1) : 0;
  const angle = p * 2 * Math.PI - Math.PI / 2; // começa no topo
  const t = useT().requests;
  return (
    <svg viewBox="0 0 100 100" className="size-20 shrink-0 md:size-24" role="img" aria-label={active ? fmt(t.ringPassed, { n: Math.floor(hours) }) : t.ringLabel}>
      <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-mel/20" />
      {p > 0 && (
        <circle
          cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${p * C} ${C}`} transform="rotate(-90 50 50)"
          className={p >= 0.75 ? "stroke-erro" : "stroke-ambar"}
        />
      )}
      <circle cx={50 + R * Math.cos(angle)} cy={50 + R * Math.sin(angle)} r="5.5" className={p >= 0.75 ? "fill-erro" : "fill-ambar"} />
      <text x="50" y="57" textAnchor="middle" className="fill-verde font-titulo text-[20px] font-bold">24h</text>
    </svg>
  );
}
