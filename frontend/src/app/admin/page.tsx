"use client";

import { RotateCw } from "lucide-react";
import { AdminHeader, AdminPanel, KpiTile } from "@/components/bz/admin";
import { useAdminAccess } from "@/components/bz/admin-shell";
import { BarChart, Funnel, monthLabel } from "@/components/bz/charts";
import { ErrorState } from "@/components/bz/states";
import { Button, Skeleton } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { formatDateTime, formatKz } from "@/lib/format";
import type { AdminMetrics, AdminPermission } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/** Visão geral: North Star, trabalho em aberto e tendências. Números agregados, sem dados pessoais. */
export default function AdminHome() {
  const m = useResource<AdminMetrics>("admin:metrics", adminApi.metrics);
  const { access, can } = useAdminAccess();
  const link = (perm: AdminPermission, href: string) => (can(perm) ? href : undefined);
  const firstName = access?.fullName.split(/\s+/)[0];

  return (
    <div className="grid gap-6">
      <AdminHeader
        title={firstName ? `Olá, ${firstName}` : "Visão geral"}
        text="Alugueres pagos e concluídos por mês é o número que conta. Em baixo, o trabalho em aberto."
        action={
          <Button variant="outline" size="sm" onClick={m.reload} disabled={m.loading}>
            <RotateCw strokeWidth={1.8} /> Atualizar
          </Button>
        }
      />

      {m.error ? (
        <AdminPanel><ErrorState message={m.error} onRetry={m.reload} className="py-8" /></AdminPanel>
      ) : !m.data ? (
        <MetricsSkeleton />
      ) : (
        <Dashboard data={m.data} link={link} />
      )}
    </div>
  );
}

function Dashboard({ data, link }: { data: AdminMetrics; link: (perm: AdminPermission, href: string) => string | undefined }) {
  const { northStar, months, funnel30d: f, commissions, kyc, marketplace, queues } = data;
  const current = months[months.length - 1];
  const delta = northStar.completedThisMonth - northStar.completedLastMonth;
  const trend = months.map((p, i) => ({ key: p.month, label: monthLabel(p.month), note: i === months.length - 1 ? "mês em curso" : undefined }));

  return (
    <>
      <section aria-labelledby="kpi-title" className="grid gap-3">
        <h2 id="kpi-title" className="text-xs font-bold tracking-[0.12em] text-cinza uppercase">Este mês</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Alugueres concluídos"
            value={northStar.completedThisMonth}
            hint={`${delta >= 0 ? "+" : ""}${delta} face ao mês passado (${northStar.completedLastMonth})`}
          />
          <KpiTile
            label="Valor alugado"
            value={formatKz(current.rentalValue)}
            hint={`${current.paid} ${current.paid === 1 ? "aluguer pago" : "alugueres pagos"} · taxa ${formatKz(current.serviceFee)}`}
          />
          <KpiTile
            label="Comissões por receber"
            value={formatKz(commissions.pendingTotal)}
            hint={commissions.pendingOwners === 0 ? "Nenhum dono em dívida" : `De ${commissions.pendingOwners} ${commissions.pendingOwners === 1 ? "dono" : "donos"}`}
            href={link("OPERATIONS_DESK", "/admin/pagamentos")}
            tone={commissions.pendingOwners > 0 ? "atencao" : "neutro"}
          />
          <KpiTile
            label="Utilizadores"
            value={marketplace.users}
            hint={`${marketplace.newUsers30d} novos em 30 dias · ${marketplace.verifiedUsers} verificados`}
            href={link("USERS_READ", "/admin/utilizadores")}
          />
        </div>
      </section>

      <section aria-labelledby="queues-title" className="grid gap-3">
        <h2 id="queues-title" className="text-xs font-bold tracking-[0.12em] text-cinza uppercase">Trabalho em aberto</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiTile
            label="Verificações por decidir"
            value={kyc.pending}
            hint={kyc.avgDecisionHours === null ? "Sem decisões em 30 dias" : `Decisão em ${formatHours(kyc.avgDecisionHours)} (média)`}
            href={link("KYC", "/admin/verificacoes")}
            tone={kyc.pending > 0 ? "atencao" : "neutro"}
          />
          {queues && (
            <>
              <KpiTile label="Pedidos à espera do dono" value={queues.awaitingOwner} href={link("OPERATIONS_DESK", "/admin/reservas?estado=PENDING_OWNER")} />
              <KpiTile label="Alugueres em curso" value={queues.inProgress} hint="Pagos ou entregues" href={link("OPERATIONS_DESK", "/admin/reservas")} />
              <KpiTile label="Reservas em disputa" value={queues.disputed} href={link("OPERATIONS_DESK", "/admin/caucoes")} tone={queues.disputed > 0 ? "atencao" : "neutro"} />
              <KpiTile label="Problemas por resolver" value={queues.openIncidents} href={link("OPERATIONS_DESK", "/admin/problemas")} tone={queues.openIncidents > 0 ? "atencao" : "neutro"} />
              <KpiTile label="Contas suspensas" value={queues.suspendedAccounts} href={link("USERS_READ", "/admin/utilizadores?estado=SUSPENDED")} />
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Alugueres concluídos" description="Por mês, últimos 6 meses" bars={months.map((p, i) => ({ ...trend[i], value: p.completed }))} />
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
        <div className="grid content-start gap-3">
          <KpiTile label="Equipamento ativo" value={marketplace.activeItems} hint={`De ${marketplace.ownersWithItems} ${marketplace.ownersWithItems === 1 ? "dono" : "donos"} (sem contas suspensas)`} />
          <KpiTile label="Verificações decididas (30 dias)" value={kyc.decided30d} />
        </div>
      </div>
      <p className="text-[13px] text-cinza">Atualizado {formatDateTime(data.generatedAt)}. Meses no fuso de Luanda.</p>
    </>
  );
}

function MetricsSkeleton() {
  return (
    <div role="status" aria-label="A carregar métricas" className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-cartao" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-cartao" />)}
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
