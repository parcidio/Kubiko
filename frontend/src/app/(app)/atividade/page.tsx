"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, BadgeCheck, Banknote, Bell, CheckCheck, ChevronRight, ClipboardCheck, Clock, Inbox, ShieldAlert, ShieldCheck, Ticket, type LucideIcon,
} from "lucide-react";
import { toast } from "@/components/bz/overlay";
import { PageHeader } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Button, ButtonLink, Card } from "@/components/bz/ui";
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

export default function AtividadePage() {
  const session = useRequireSession();
  const router = useRouter();
  const list = useResource<AppNotification[]>(session ? "notifications:me" : null, () => notificationApi.mine());
  const [markingAll, setMarkingAll] = useState(false);
  const [now] = useState(() => Date.now()); // instante fixo por visita: o render tem de ser puro

  if (!session) return null;
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;

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
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader
        title="Atividade"
        subtitle={unread > 0 ? `${unread} ${unread === 1 ? "aviso por ler" : "avisos por ler"}` : "Pedidos, pagamentos, entregas e cauções."}
        action={
          unread > 0 && (
            <Button variant="ghost" size="sm" loading={markingAll} onClick={markAll}>
              <CheckCheck strokeWidth={1.8} /> <span className="hidden sm:inline">Marcar todas como lidas</span>
              <span className="sm:hidden">Lidas</span>
            </Button>
          )
        }
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Tudo calmo"
          text="Quando houver novidades (um pedido, um pagamento, uma entrega), aparecem aqui."
          action={<ButtonLink href="/explorar">Explorar</ButtonLink>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {items.map((n) => {
              const Icon = iconOf(n.type);
              const isUnread = !n.readAt;
              const href = safeLink(n.linkPath);
              return (
                <li key={n.id} className="border-b border-borda last:border-0">
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn("flex w-full gap-3 px-4 py-4 text-left transition hover:bg-areia focus-visible:bg-areia focus-visible:outline-none", isUnread && "bg-ambar-tint/50")}
                  >
                    <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full", isUnread ? "bg-verde text-ambar" : "bg-areia-2 text-cinza")}>
                      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                    </span>
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
        </Card>
      )}
      {items.length >= 50 && <p className="text-center text-[13px] text-cinza">Mostramos os 50 avisos mais recentes.</p>}
    </div>
  );
}
