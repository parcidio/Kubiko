"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Banknote, CheckCircle2, Flag, Package, ScrollText, ShieldCheck, Timer, Users, Wallet, type LucideIcon } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { BarChart, Funnel, monthLabel, StatTile } from "@/components/bz/charts";
import { ErrorState } from "@/components/bz/states";
import { Card, Skeleton } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { formatDateTime, formatKz } from "@/lib/format";
import type { AdminMetrics, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const total = (p: Page<unknown>) => p.page?.totalElements ?? p.content.length;

const QUEUES: { href: string; title: string; text: string; icon: LucideIcon; count: () => Promise<number> }[] = [
  { href: "/admin/verificacoes", title: "Verificações pendentes", text: "BI, selfie e NIF para aprovar", icon: BadgeCheck, count: () => adminApi.kycQueue(0, 1).then(total) },
  { href: "/admin/pagamentos", title: "Comissões por receber", text: "Donos com taxa de serviço por entregar", icon: Banknote, count: () => adminApi.commissions().then((c) => c.length) },
  { href: "/admin/caucoes", title: "Cauções em disputa", text: "Problema reportado: a equipa medeia", icon: ShieldCheck, count: () => adminApi.deposits(0, 1).then(total) },
  { href: "/admin/problemas", title: "Problemas reportados", text: "Dano, perda, roubo", icon: Flag, count: () => adminApi.incidents(0, 1).then(total) },
];

export default function AdminHome() {
  return (
    <div className="grid max-w-6xl gap-6">
      <AdminHeader title="Visão geral" text="Alugueres concluídos por mês é o número que conta. Por baixo, as filas: o mais antigo primeiro." />
      <Metrics />
      <h2 className="mt-2 font-titulo text-xl font-bold text-verde">Filas</h2>
      <div className="entra-cascata grid gap-4 sm:grid-cols-2">
        {QUEUES.map((q) => (
          <QueueCard key={q.href} {...q} />
        ))}
      </div>
      <Link href="/admin/auditoria" className="group">
        <Card className="flex items-center gap-4 p-5 transition group-hover:border-verde group-active:scale-[.98]">
          <span className="flex size-11 items-center justify-center rounded-full bg-areia-2 text-mel">
            <ScrollText className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-bold text-verde">Auditoria e segurança</p>
            <p className="text-sm text-cinza">Quem fez o quê e quando; logins, 2FA e sessões suspeitas.</p>
          </div>
          <ArrowRight className="size-5 text-cinza transition group-hover:translate-x-1 group-hover:text-verde" strokeWidth={1.8} aria-hidden />
        </Card>
      </Link>
    </div>
  );
}

function QueueCard({ href, title, text, icon: Icon, count }: (typeof QUEUES)[number]) {
  const n = useResource<number>(`admin:count:${href}`, count);
  return (
    <Link href={href} className="group">
      <Card className="grid gap-4 p-5 transition group-hover:border-verde group-active:scale-[.98]">
        <div className="flex items-center justify-between">
          <span className="flex size-11 items-center justify-center rounded-full bg-verde text-ambar">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <ArrowRight className="size-5 text-cinza transition group-hover:translate-x-1 group-hover:text-verde" strokeWidth={1.8} aria-hidden />
        </div>
        <div>
          <p className="num font-titulo text-4xl font-extrabold text-verde" aria-live="polite">
            {n.data !== undefined ? n.data : n.error ? <span title={n.error}>—</span> : <span role="status" aria-label="A carregar" className="text-borda-forte">·</span>}
          </p>
          <p className="font-bold text-verde">{title}</p>
          <p className="text-sm text-cinza">{text}</p>
        </div>
      </Card>
    </Link>
  );
}

function Metrics() {
  const m = useResource<AdminMetrics>("admin:metrics", adminApi.metrics);
  if (m.error) return <Card><ErrorState message={m.error} onRetry={m.reload} className="py-8" /></Card>;
  if (!m.data) return <MetricsSkeleton />;

  const { northStar, months, funnel30d: f, commissions, kyc, marketplace } = m.data;
  const current = months[months.length - 1];
  const trend = months.map((p, i) => ({
    key: p.month,
    label: monthLabel(p.month),
    note: i === months.length - 1 ? "mês em curso" : undefined,
  }));

  return (
    <section aria-label="Métricas" className="grid gap-4">
      <div className="entra-cascata grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          accent
          icon={CheckCircle2}
          label="Alugueres concluídos este mês"
          value={northStar.completedThisMonth}
          delta={{ value: northStar.completedThisMonth - northStar.completedLastMonth, label: "face ao mês passado" }}
        />
        <StatTile
          icon={Banknote}
          label="Valor alugado este mês"
          value={formatKz(current.rentalValue)}
          hint={`${current.paid} ${current.paid === 1 ? "aluguer pago" : "alugueres pagos"} · taxa ${formatKz(current.serviceFee)}`}
        />
        <StatTile
          icon={Wallet}
          label="Comissões por receber"
          value={formatKz(commissions.pendingTotal)}
          hint={commissions.pendingOwners === 0 ? "Nenhum dono em dívida" : `De ${commissions.pendingOwners} ${commissions.pendingOwners === 1 ? "dono" : "donos"}`}
        />
        <StatTile
          icon={Timer}
          label="Verificações por decidir"
          value={kyc.pending}
          hint={kyc.avgDecisionHours === null ? "Sem decisões nos últimos 30 dias" : `Decisão em ${formatHours(kyc.avgDecisionHours)}, em média (30 dias)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Alugueres concluídos"
          description="Por mês, últimos 6 meses"
          bars={months.map((p, i) => ({ ...trend[i], value: p.completed }))}
        />
        <BarChart
          title="Valor alugado"
          description="Aluguer dos pagamentos confirmados, sem taxa nem caução"
          bars={months.map((p, i) => ({ ...trend[i], value: p.rentalValue }))}
          format={formatKz}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Funnel
          title="Funil de pedidos"
          description="Pedidos feitos nos últimos 30 dias, pelo estado atual"
          steps={[
            { label: "Pedidos", value: f.requested, hint: f.pending > 0 ? `${f.pending} à espera do dono` : undefined },
            { label: "Aceites pelo dono", value: f.accepted },
            { label: "Pagos ao dono", value: f.paid },
            { label: "Concluídos", value: f.completed },
            { label: "Recusados, cancelados ou expirados", value: f.lost },
          ]}
        />
        <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatTile
            icon={Users}
            label="Utilizadores"
            value={marketplace.users}
            hint={`${marketplace.newUsers30d} novos em 30 dias · ${marketplace.verifiedUsers} verificados`}
          />
          <StatTile
            icon={Package}
            label="Equipamento ativo"
            value={marketplace.activeItems}
            hint={`De ${marketplace.ownersWithItems} ${marketplace.ownersWithItems === 1 ? "dono" : "donos"}`}
          />
        </div>
      </div>
      <p className="text-xs text-cinza">Atualizado {formatDateTime(m.data.generatedAt)}. Meses no fuso de Luanda.</p>
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <div role="status" aria-label="A carregar métricas" className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-cartao" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-cartao" />
        <Skeleton className="h-72 rounded-cartao" />
      </div>
    </div>
  );
}

// 0.5 → "30 min" · 5.25 → "5 h" · 50 → "2 dias"
function formatHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} dias`;
}
