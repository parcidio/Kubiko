"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Clock, CreditCard, Info, Ticket, Wallet, Wifi } from "lucide-react";
import { HexTile } from "@/components/bz/hex";
import { ErrorState, HiveEmptyState, ListSkeleton } from "@/components/bz/states";
import { Badge, Kz, Skeleton } from "@/components/bz/ui";
import { paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { CHANNEL_LABEL, type CommissionLine } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/**
 * Pagamento direto (decisoes-produto.md 2026-11-15): o dono recebe na entrega e entrega a taxa de serviço à Beeznoo.
 * A Carteira mostra o que recebeu e a taxa por entregar. A Beeznoo não guarda dinheiro: não há saldo a levantar
 * (o cartão do cabeçalho é ilustrativo e mostra só a taxa por entregar).
 */

type Period = "30" | "90" | "all";
const PERIODS: { value: Period; label: string }[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Desde o início" },
];

const kz = (v: number) => `${Math.round(v).toLocaleString("de-DE")} Kz`;
/** O arrendatário paga na entrega aluguer + taxa + caução (PaymentService): a caução é o que sobra do total. */
const depositOf = (l: CommissionLine) => Math.max(0, Number(l.amountReceived) - Number(l.rentalAmount) - Number(l.serviceFee));

export default function CarteiraPage() {
  const session = useRequireSession();
  const router = useRouter();
  const data = useResource(session ? "commissions:me" : null, () => paymentApi.myCommissions());
  const [period, setPeriod] = useState<Period>("30");
  const [now] = useState(() => Date.now()); // instante fixo por visita: o render tem de ser puro

  if (!session) return null;
  const lines = data.data?.lines ?? [];
  const due = Number(data.data?.due ?? 0);
  const received = lines.reduce((s, l) => s + Number(l.rentalAmount), 0);
  const since = period === "all" ? 0 : now - Number(period) * 86_400_000;
  const visible = lines.filter((l) => new Date(l.confirmedAt).getTime() >= since);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 md:gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start text-[15px] font-bold text-mel-texto hover:underline"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        Voltar
      </button>

      {/* Cabeçalho escuro: título + alugueres recebidos à esquerda, cartão ilustrativo à direita */}
      <section className="superficie-marca relative overflow-hidden rounded-sheet bg-verde p-5 text-areia md:p-10">
        <div className="hex-bg absolute inset-0 opacity-80" aria-hidden />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] md:items-center md:gap-10">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <p className="text-xs font-bold tracking-[0.14em] text-salvia uppercase">O teu negócio na Beeznoo</p>
              <h1 className="font-titulo text-[32px] leading-none font-extrabold tracking-[-0.025em] text-white md:text-[44px]">Carteira</h1>
              <p className="max-w-md text-salvia-tint">O que recebeste na entrega e a taxa de serviço por entregar à Beeznoo.</p>
            </div>
            <div className="flex items-center gap-4 justify-self-start rounded-cartao border border-white/10 bg-white/5 p-4 pr-6">
              <HexTile icon={Wallet} tone="salvia" size={44} />
              <div className="grid gap-0.5">
                <p className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Alugueres recebidos</p>
                {data.loading ? <Skeleton className="h-8 w-28 bg-white/10" /> : <Kz value={received} className="text-[28px] leading-tight text-white" />}
                <p className="text-[13px] text-salvia-tint">Sem a taxa de serviço nem as cauções.</p>
              </div>
            </div>
          </div>

          <WalletCard due={due} payments={lines.length} loading={data.loading} />
        </div>
      </section>

      {/* "Como funciona", recolhido por omissão */}
      <details className="group rounded-cartao border border-ambar/30 bg-ambar-tint text-aviso-texto">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 font-bold text-verde md:px-5 [&::-webkit-details-marker]:hidden">
          <Info className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
          <span className="flex-1">Como funciona</span>
          <ChevronDown className="size-5 shrink-0 text-mel transition-transform duration-200 group-open:rotate-180" strokeWidth={1.8} aria-hidden />
        </summary>
        <p className="px-4 pb-4 pl-12 text-sm leading-6 md:px-5 md:pl-13">
          O arrendatário paga-te na entrega (aluguer + taxa de serviço + caução). Ficas com o aluguer, devolves a caução no fim e entregas a taxa de serviço à Beeznoo.
        </p>
      </details>

      <div className="overflow-hidden rounded-cartao border border-borda bg-branco">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda p-3 pl-4 md:p-4 md:pl-6">
          <h2 className="font-titulo text-lg font-bold text-verde md:text-xl">Pagamentos recebidos</h2>
          <label className="relative">
            <span className="sr-only">Período</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="h-12 cursor-pointer appearance-none rounded-campo border-[1.5px] border-borda-forte bg-branco pr-11 pl-4 text-base text-verde outline-none transition focus:border-verde-medio focus:ring-[3px] focus:ring-salvia-tint"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-verde" strokeWidth={1.8} aria-hidden />
          </label>
        </div>

        {/* Cabeçalho da tabela (só no desktop; no telemóvel cada pagamento é um cartão) */}
        <div className="hidden grid-cols-[7rem_minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_9.5rem_1.25rem] gap-4 border-b border-borda bg-areia/60 px-6 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase md:grid" aria-hidden>
          <span>Data</span>
          <span>Equipamento</span>
          <span className="text-right">Aluguer</span>
          <span className="text-right">Taxa</span>
          <span className="text-right">Caução</span>
          <span>Estado</span>
          <span />
        </div>

        {data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : data.loading ? (
          <div className="p-4"><ListSkeleton rows={3} /></div>
        ) : visible.length === 0 ? (
          <HiveEmptyState
            icon={Wallet}
            satellites={[ArrowUpRight, Ticket]}
            title={lines.length === 0 ? "Ainda sem pagamentos" : "Nada neste período"}
            text={
              lines.length === 0
                ? "Quando confirmares que recebeste um pagamento na entrega, aparece aqui."
                : "Não há pagamentos confirmados neste período. Escolhe outro período para ver os anteriores."
            }
          />
        ) : (
          <ul className="entra-cascata">
            {visible.map((l) => (
              <li key={l.paymentId} className="border-b border-borda last:border-0">
                <PaymentRow line={l} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Cartão ilustrativo (verde sobre um cartão âmbar inclinado): a taxa por entregar e o número de pagamentos. */
function WalletCard({ due, payments, loading }: { due: number; payments: number; loading: boolean }) {
  return (
    <div className="grid gap-5 md:mr-4">
      <div className="relative">
        {/* cartão de trás: decorativo */}
        <div className="absolute inset-0 translate-x-2 translate-y-3 rotate-[5deg] rounded-sheet bg-linear-to-br from-ambar to-mel shadow-flutua md:translate-x-4 md:translate-y-4" aria-hidden />
        <div className="relative grid gap-5 rounded-sheet border border-white/15 bg-linear-to-br from-verde-medio to-verde p-5 shadow-flutua md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-[11px] font-bold tracking-[0.14em] text-salvia uppercase">Carteira Beeznoo</p>
              <p className="font-titulo text-xl font-bold text-white">Recebes na entrega</p>
            </div>
            <CreditCard className="size-6 shrink-0 text-ambar" strokeWidth={1.8} aria-hidden />
          </div>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="grid h-9 w-12 grid-cols-3 grid-rows-2 gap-px overflow-hidden rounded-md bg-mel/60 p-px">
              {Array.from({ length: 6 }, (_, i) => <span key={i} className="bg-linear-to-br from-ambar to-mel" />)}
            </span>
            <Wifi className="size-5 rotate-90 text-salvia-tint" strokeWidth={1.8} />
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="grid min-w-0 gap-1">
              <p className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Taxa por entregar à Beeznoo</p>
              {loading ? <Skeleton className="h-9 w-28 bg-white/10" /> : <Kz value={due} className="text-[32px] leading-none text-white" />}
            </div>
            <div className="grid shrink-0 gap-1 text-right">
              <p className="text-[11px] font-bold tracking-[0.12em] text-salvia uppercase">Pagamentos</p>
              <p className="num font-titulo text-xl leading-none font-bold text-white">{loading ? "–" : payments}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="relative inline-flex items-center gap-2 justify-self-start rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-bold text-salvia backdrop-blur-sm">
        {due > 0 ? <Clock className="size-4" strokeWidth={2} aria-hidden /> : <Check className="size-4" strokeWidth={2.2} aria-hidden />}
        {due > 0 ? "A equipa Beeznoo contacta-te para combinar a entrega" : "Não deves nada à Beeznoo"}
      </p>
    </div>
  );
}

/** Um pagamento: linha de tabela no desktop, cartão no telemóvel. Abre a reserva. */
function PaymentRow({ line: l }: { line: CommissionLine }) {
  const deposit = depositOf(l);
  const status = l.commissionSettledAt ? (
    <Badge tone="ok" icon={Check}>Taxa entregue</Badge>
  ) : (
    <Badge tone="pendente">Taxa por entregar</Badge>
  );
  const meta = [l.channel ? CHANNEL_LABEL[l.channel] : null, l.receiptNumber].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/reservas/${l.bookingId}`}
      className="group grid gap-2 px-4 py-4 transition-colors duration-200 hover:bg-areia focus-visible:bg-areia md:grid-cols-[7rem_minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_9.5rem_1.25rem] md:items-center md:gap-4 md:px-6"
    >
      <span className="hidden text-sm text-cinza md:block">{formatDateTime(l.confirmedAt)}</span>
      <span className="grid min-w-0 gap-0.5">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate font-titulo font-bold text-verde">{l.itemTitle}</span>
          <ChevronRight className="size-5 shrink-0 text-cinza md:hidden" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="truncate text-[13px] text-cinza">
          <span className="md:hidden">{formatDateTime(l.confirmedAt)}{meta && " · "}</span>
          {meta}
        </span>
      </span>
      {/* telemóvel: os três valores lado a lado, com etiqueta */}
      <dl className="grid grid-cols-3 gap-2 rounded-campo bg-areia p-3 md:contents">
        <Amount label="Aluguer" value={Number(l.rentalAmount)} strong />
        <Amount label="Taxa" value={Number(l.serviceFee)} />
        <Amount label="Caução" value={deposit} />
      </dl>
      <span className="justify-self-start">{status}</span>
      <ChevronRight className="hidden size-5 text-cinza transition-transform duration-200 group-hover:translate-x-1 md:block" strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="grid gap-0.5 md:text-right">
      <dt className="text-[11px] font-bold tracking-[0.1em] text-cinza uppercase md:sr-only">{label}</dt>
      <dd className={strong ? "num font-titulo font-bold whitespace-nowrap text-verde" : "num text-sm whitespace-nowrap text-texto-corpo"}>{kz(value)}</dd>
    </div>
  );
}
