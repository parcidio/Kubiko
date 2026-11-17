"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, ChevronDown, Lightbulb, Search, Ticket } from "lucide-react";
import { BookingRow } from "@/components/bz/booking";
import { HexTile } from "@/components/bz/hex";
import { ErrorState, HiveEmptyState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { ButtonLink } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/booking";
import { formatRange, todayIso } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

type Tab = "open" | "past";
type Sort = "recent" | "start" | "oldest";

const SORTS: Sort[] = ["recent", "start", "oldest"];

/** Sem acentos nem maiúsculas, para a pesquisa ("camara" encontra "Câmara"). */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function sortBookings(list: Booking[], sort: Sort) {
  const by = {
    recent: (a: Booking, b: Booking) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a: Booking, b: Booking) => a.createdAt.localeCompare(b.createdAt),
    start: (a: Booking, b: Booking) => a.startDate.localeCompare(b.startDate),
  }[sort];
  return [...list].sort(by);
}

export default function ReservasPage() {
  const session = useRequireSession();
  const [tab, setTab] = useState<Tab>("open");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const { data, error, loading, reload } = useResource(session ? "bookings:renter" : null, () => bookingApi.mine());
  const t = useT().bookings;

  const all = useMemo(() => data?.content ?? [], [data]);
  const open = all.filter((b) => OPEN_STATUSES.includes(b.status));
  const past = all.filter((b) => !OPEN_STATUSES.includes(b.status));
  const waiting = open.filter((b) => b.status === "PENDING_OWNER").length;
  const completed = all.filter((b) => b.status === "COMPLETED").length;
  // Próxima reserva: a primeira já aceite que ainda não começou (ou começa hoje)
  const today = todayIso();
  const next = sortBookings(
    open.filter((b) => b.status !== "PENDING_OWNER" && b.startDate >= today),
    "start",
  )[0];

  const q = norm(query);
  const list = sortBookings(
    (tab === "open" ? open : past).filter((b) => !q || norm(b.itemTitle).includes(q) || norm(b.ownerName).includes(q)),
    sort,
  );

  if (!session) return null;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:gap-6">
      {/* Cabeçalho escuro com o bilhete-resumo */}
      <section className="superficie-marca relative overflow-hidden rounded-sheet bg-verde p-5 text-areia md:p-8">
        <div className="hex-bg absolute inset-0 opacity-80" aria-hidden />
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ambar/15 blur-3xl" aria-hidden />
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
          <div className="flex items-center gap-4">
            <HexTile icon={Ticket} size={56} className="bg-ambar text-sobre-ambar md:hidden" />
            <HexTile icon={Ticket} size={76} className="hidden bg-ambar text-sobre-ambar md:inline-flex" />
            <div className="grid min-w-0 gap-1">
              <h1 className="font-titulo text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-white md:text-[34px] lg:whitespace-nowrap">{t.title}</h1>
              <p className="text-salvia-tint">{t.subtitle}</p>
            </div>
          </div>
          <SummaryTicket loading={loading} next={next} active={open.length - waiting} waiting={waiting} completed={completed} />
        </div>
      </section>

      <Segmented
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        counts="neutral"
        options={[
          { value: "open", label: t.open, count: open.length },
          { value: "past", label: t.past, count: past.length },
        ]}
      />

      <div className="overflow-hidden rounded-cartao border border-borda bg-branco">
        {/* Pesquisa e ordenação */}
        <div className="grid gap-2 border-b border-borda p-3 sm:grid-cols-[minmax(0,1fr)_14rem] md:p-4">
          <label className="relative">
            <span className="sr-only">{t.search}</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="h-12 w-full rounded-campo border-[1.5px] border-borda-forte bg-branco pr-4 pl-12 text-base text-verde outline-none transition placeholder:text-cinza focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
            />
          </label>
          <label className="relative">
            <span className="sr-only">{t.sort}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-12 w-full cursor-pointer appearance-none rounded-campo border-[1.5px] border-borda-forte bg-branco pr-11 pl-4 text-base text-verde outline-none transition focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>{t.sorts[s]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-verde" strokeWidth={1.8} aria-hidden />
          </label>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <div className="p-3 md:p-4"><ListSkeleton /></div>
        ) : list.length === 0 ? (
          q ? (
            <HiveEmptyState icon={Ticket} satellites={[Camera, Lightbulb]} title={t.notFoundTitle} text={fmt(t.notFoundText, { q: query.trim() })} />
          ) : tab === "open" ? (
            <HiveEmptyState
              icon={Ticket}
              satellites={[Camera, Lightbulb]}
              title={t.emptyOpenTitle}
              text={t.emptyOpenText}
              action={
                <ButtonLink href="/explorar" variant="primary">
                  <Search strokeWidth={2} /> {t.explore}
                </ButtonLink>
              }
            />
          ) : (
            <HiveEmptyState icon={Ticket} satellites={[Camera, Lightbulb]} title={t.emptyPastTitle} text={t.emptyPastText} />
          )
        ) : (
          <ul className="grid gap-3 p-3 md:p-4">
            {list.map((b, i) => (
              <li key={b.id}>
                <BookingRow booking={b} as="renter" index={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Bilhete-resumo no cabeçalho: próxima reserva + contagens, com o canhoto das concluídas. */
function SummaryTicket({
  loading, next, active, waiting, completed,
}: { loading: boolean; next?: Booking; active: number; waiting: number; completed: number }) {
  const t = useT().bookings;
  const lang = useLang();
  const body = (
    <>
      <div className="grid min-w-0 flex-1 content-center gap-1 py-4 pr-3 pl-4 md:px-5">
        <p className="text-[11px] font-bold tracking-[0.12em] text-cinza uppercase">{t.next}</p>
        <p className="truncate font-titulo text-base leading-tight font-bold text-verde sm:text-lg">
          {loading ? t.loading : next ? next.itemTitle : t.noneScheduled}
        </p>
        <p className="num truncate text-[13px] text-cinza">
          {next ? `${formatRange(next.startDate, next.endDate, lang)} · ` : ""}
          {plural(active, t.active)} · {fmt(t.waiting, { n: waiting })}
        </p>
      </div>
      {/* picotado vertical com os recortes do bilhete (cor do cabeçalho) */}
      <div className="relative w-0 border-l-2 border-dashed border-ambar/60" aria-hidden>
        <span className="absolute -top-2 -left-[9px] size-4 rounded-full bg-verde" />
        <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full bg-verde" />
      </div>
      <div className="grid w-20 shrink-0 place-content-center bg-ambar-tint px-2 text-center sm:w-24 md:w-28">
        <p className="num font-titulo text-3xl leading-none font-extrabold text-verde">{loading ? "–" : completed}</p>
        <p className="mt-1 text-[13px] text-aviso-texto">{completed === 1 ? t.completed.one : t.completed.other}</p>
      </div>
    </>
  );
  const shell = cn(
    "flex min-h-24 overflow-hidden rounded-cartao bg-areia shadow-flutua md:w-[26rem] md:-rotate-2",
    next && "transition-transform duration-200 hover:rotate-0 focus-visible:rotate-0",
  );
  return next ? (
    <Link href={`/reservas/${next.id}`} className={shell} aria-label={fmt(t.nextLabel, { title: next.itemTitle })}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
