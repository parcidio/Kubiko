"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, BadgeCheck, Banknote, Bell, CheckCheck, ChevronRight, ClipboardCheck, Clock, Inbox, ShieldAlert, ShieldCheck, Ticket, Wallet,
  type LucideIcon,
} from "lucide-react";
import { CategoryChip } from "@/components/bz/equipment";
import { HexTile } from "@/components/bz/hex";
import { toast } from "@/components/bz/overlay";
import { ErrorState, HiveEmptyState, ListSkeleton } from "@/components/bz/states";
import { Button, ButtonLink } from "@/components/bz/ui";
import { notificationApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { refreshUnread, safeLink } from "@/lib/notifications";
import type { AppNotification } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

/** Ícone pelo tipo (NotificationType no backend); desconhecido → sino. */
function iconOf(type: string): LucideIcon {
  if (type === "BOOKING_RECEIVED") return Inbox;
  if (type === "BOOKING_EXPIRED") return Clock;
  if (type.startsWith("BOOKING_")) return Ticket;
  if (type.startsWith("PAYMENT_")) return Banknote;
  if (type.startsWith("CHECKLIST_")) return ClipboardCheck;
  if (type.startsWith("DEPOSIT_")) return ShieldCheck;
  if (type.startsWith("INCIDENT_")) return AlertTriangle;
  if (type.startsWith("KYC_")) return BadgeCheck;
  if (type === "SECURITY_ALERT") return ShieldAlert;
  return Bell;
}

// Filtros por tipo de aviso. Problemas, verificação e segurança aparecem só em "Tudo".
type Filter = "all" | "requests" | "payments" | "handovers" | "deposits";
const FILTERS: { value: Filter; label: string; prefix?: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "requests", label: "Pedidos", prefix: "BOOKING_" },
  { value: "payments", label: "Pagamentos", prefix: "PAYMENT_" },
  { value: "handovers", label: "Entregas", prefix: "CHECKLIST_" },
  { value: "deposits", label: "Cauções", prefix: "DEPOSIT_" },
];

const EMPTY_TEXT: Record<Filter, string> = {
  all: "Quando houver novidades (um pedido, um pagamento, uma entrega), aparecem aqui.",
  requests: "Ainda sem avisos de pedidos. Quando pedires ou aceitarem um aluguer, aparece aqui.",
  payments: "Ainda sem avisos de pagamentos.",
  handovers: "Ainda sem avisos de entregas ou devoluções.",
  deposits: "Ainda sem avisos de cauções.",
};

// "agora", "há 5 min", "há 3 h", "ontem"; mais antigo → data
function since(iso: string, now: number) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  if (h < 48) return "ontem";
  return formatDateTime(iso);
}

/** "2026-11-16" no fuso do telemóvel. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AtividadePage() {
  const session = useRequireSession();
  const router = useRouter();
  const list = useResource<AppNotification[]>(session ? "notifications:me" : null, () => notificationApi.mine());
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState(() => Date.now()); // instante fixo por visita: o render tem de ser puro

  if (!session) return null;
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;
  const prefix = FILTERS.find((f) => f.value === filter)?.prefix;
  const visible = prefix ? items.filter((n) => n.type.startsWith(prefix)) : items;

  async function open(n: AppNotification) {
    if (!n.readAt) {
      // marca como lida sem esperar: abrir o destino não pode depender da rede
      notificationApi.markRead(n.id).then(refreshUnread, () => {});
      list.setData(items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    const href = safeLink(n.linkPath);
    if (href) router.push(href);
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      const at = new Date().toISOString();
      list.setData(items.map((x) => (x.readAt ? x : { ...x, readAt: at })));
      refreshUnread();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar como lidas.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:gap-6">
      {/* Cabeçalho claro (areia-2 + favo) com a semana em hexágonos */}
      <section className="relative overflow-hidden rounded-sheet bg-areia-2 p-5 md:p-8">
        <div className="hex-bg absolute inset-0 opacity-90" aria-hidden />
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
          <div className="flex items-center gap-4">
            <span className="relative shrink-0">
              <HexTile icon={Bell} size={56} tone="verde" className="text-white md:hidden" />
              <HexTile icon={Bell} size={76} tone="verde" className="hidden text-white md:inline-flex" />
              {unread > 0 && <span className="absolute top-0.5 right-0 size-4 rounded-full border-2 border-areia-2 bg-ambar md:top-1 md:size-5" aria-hidden />}
            </span>
            <div className="grid min-w-0 gap-1">
              <h1 className="font-titulo text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-verde md:text-[34px]">Atividade</h1>
              <p className="text-texto-corpo">
                {unread > 0 ? `${unread} ${unread === 1 ? "aviso por ler" : "avisos por ler"}` : "Pedidos, pagamentos, entregas e cauções."}
              </p>
            </div>
          </div>
          <WeekHive items={items} now={now} loading={list.loading} />
        </div>
      </section>

      <div className="overflow-hidden rounded-cartao border border-borda bg-branco">
        {/* Filtros por tipo; no telemóvel deslizam na horizontal */}
        <div className="flex flex-col gap-2 border-b border-borda p-3 sm:flex-row sm:items-center sm:gap-3 md:p-4">
          <div role="group" aria-label="Filtrar avisos" className="faixa -mx-3 -my-1 min-w-0 flex-1 gap-2 px-3 py-1 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <CategoryChip key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />
            ))}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" loading={markingAll} onClick={markAll} className="shrink-0 self-end sm:self-auto">
              <CheckCheck strokeWidth={1.8} /> Marcar todas como lidas
            </Button>
          )}
        </div>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading ? (
          <div className="p-3 md:p-4"><ListSkeleton /></div>
        ) : visible.length === 0 ? (
          <HiveEmptyState
            icon={Bell}
            satellites={[Ticket, Wallet]}
            title={filter === "all" ? "Tudo calmo" : "Nada por aqui"}
            text={EMPTY_TEXT[filter]}
            action={filter === "all" ? <ButtonLink href="/explorar" variant="outline">Explorar equipamento</ButtonLink> : undefined}
          />
        ) : (
          <ul className="entra-cascata">
            {visible.map((n) => {
              const Icon = iconOf(n.type);
              const isUnread = !n.readAt;
              const href = safeLink(n.linkPath);
              return (
                <li key={n.id} className="border-b border-borda last:border-0">
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn("flex w-full gap-3 px-4 py-4 text-left transition-colors duration-200 hover:bg-areia focus-visible:bg-areia focus-visible:outline-none", isUnread && "bg-ambar-tint/50")}
                  >
                    <HexTile icon={Icon} tone={isUnread ? "verde" : "areia"} size={40} className="mt-0.5" />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex items-start gap-2">
                        <span className={cn("flex-1 text-[15px]", isUnread ? "font-bold text-verde" : "font-medium text-texto-corpo")}>{n.title}</span>
                        {isUnread && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-erro" aria-label="Por ler" />}
                      </span>
                      <span className="line-clamp-3 text-sm whitespace-pre-line text-cinza">{n.body}</span>
                      <span className="text-[13px] text-cinza">{since(n.createdAt, now)}</span>
                    </span>
                    {href && <ChevronRight className="mt-2 size-5 shrink-0 text-cinza" strokeWidth={1.8} aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {items.length >= 50 && <p className="text-center text-[13px] text-cinza">Mostramos os 50 avisos mais recentes.</p>}
    </div>
  );
}

const WEEKDAY = ["S", "T", "Q", "Q", "S", "S", "D"]; // segunda a domingo
const WEEKDAY_NAME = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/** "Esta semana": segunda a domingo em hexágonos; cheio = houve avisos nesse dia, contorno escuro = hoje. */
function WeekHive({ items, now, loading }: { items: AppNotification[]; now: number; loading: boolean }) {
  const today = new Date(now);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dayKey(d);
  });
  const perDay = new Map<string, number>();
  for (const n of items) {
    const k = dayKey(new Date(n.createdAt));
    if (days.includes(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const week = [...perDay.values()].reduce((a, b) => a + b, 0);
  const todayKey = dayKey(today);

  return (
    <div className="rounded-cartao border border-borda bg-branco/70 p-4 backdrop-blur-sm md:w-[22rem]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-verde">Esta semana</p>
        <p className="num text-[13px] text-cinza">{loading ? "…" : `${week} ${week === 1 ? "novidade" : "novidades"}`}</p>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((k, i) => {
          const count = perDay.get(k) ?? 0;
          const isToday = k === todayKey;
          const future = k > todayKey;
          return (
            <li key={k} className="grid justify-items-center gap-1" aria-label={`${isToday ? "Hoje" : WEEKDAY_NAME[i]}: ${count} ${count === 1 ? "aviso" : "avisos"}`}>
              <svg viewBox="0 0 40 46" className="w-full max-w-10" aria-hidden>
                <polygon
                  points="20,2 38,12.5 38,33.5 20,44 2,33.5 2,12.5"
                  strokeWidth={isToday ? 3 : 1.6}
                  className={cn(
                    count > 0 ? "fill-ambar-tint stroke-mel" : future ? "fill-areia stroke-borda" : "fill-branco stroke-borda-forte",
                    isToday && "stroke-verde",
                  )}
                />
                {count > 0 && (
                  <text x="20" y="28" textAnchor="middle" className="num fill-aviso-texto font-titulo text-[14px] font-bold">{count}</text>
                )}
              </svg>
              <span className={cn("text-xs", isToday ? "font-bold text-verde" : "text-cinza")}>{isToday ? "Hoje" : WEEKDAY[i]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
