"use client";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CreditCard, Lock, Radio, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { HexGlow } from "@/components/bz/brand";
import { PageHeader } from "@/components/bz/shell";
import { BackendPending, EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Card, Eyebrow, Kz, Skeleton } from "@/components/bz/ui";
import { walletApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";

const ENTRY_LABEL: Record<string, string> = {
  HOLD: "Valor retido",
  HOLD_RELEASE: "Retenção libertada",
  PAYMENT_DEBIT: "Pagamento de aluguer",
  PAYMENT_CREDIT: "Aluguer recebido",
  DEPOSIT_HOLD: "Caução retida",
  DEPOSIT_RETURN: "Caução devolvida",
  DEPOSIT_FORFEIT: "Caução retida por problema",
  ADJUSTMENT: "Ajuste da equipa",
  TOPUP: "Pagamento por referência",
  SERVICE_FEE: "Taxa de serviço",
};

export default function CarteiraPage() {
  const session = useRequireSession();
  const router = useRouter();
  const account = useResource(session ? "account" : null, () => walletApi.account());
  const statement = useResource(session ? "statement" : null, () => walletApi.statement());

  if (!session) return null;
  const entries = statement.data?.content ?? [];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex cursor-pointer min-h-11 items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline"
      >
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
        Voltar
      </button>
      <PageHeader title="Carteira" subtitle="O que recebeste e o que está retido." />

      <section className="relative overflow-hidden rounded-sheet bg-verde-noite p-5 text-areia md:p-8">
        <HexGlow />
        <div className="relative grid gap-5">
          <div className="relative grid min-h-56 gap-7 overflow-hidden rounded-sheet border border-white/15 bg-linear-to-br from-verde-medio via-verde to-verde-noite p-5 shadow-flutua md:min-h-64 md:max-w-xl md:p-7">
            <div className="absolute -right-16 -bottom-24 size-64 rounded-full bg-ambar/15 blur-3xl" aria-hidden />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-areia/65 uppercase">Beeznoo Pay</p>
                <p className="mt-1 font-titulo text-lg font-bold">Carteira digital</p>
              </div>
              <CreditCard className="size-7 text-ambar" strokeWidth={1.6} aria-hidden />
            </div>
            <div className="relative flex items-center gap-3">
              <span className="flex h-9 w-12 items-center justify-center rounded-md border border-ambar/60 bg-ambar/20" aria-hidden>
                <span className="h-5 w-7 rounded-sm border border-ambar/70" />
              </span>
              <Radio className="size-5 rotate-90 text-areia/70" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] text-areia/55 uppercase">Saldo disponível</p>
                {account.loading ? <Skeleton className="mt-1 h-9 w-44 bg-white/10" /> : <Kz value={account.data?.availableBalance} className="mt-1 text-[36px] leading-none text-ambar" />}
              </div>
              <Wallet className="size-9 text-areia/60" strokeWidth={1.4} aria-hidden />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-cartao border border-white/10 bg-white/8 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-ambar/15 text-ambar"><Lock className="size-4" strokeWidth={1.8} aria-hidden /></span>
              <div><p className="text-sm font-bold">Valor retido</p><p className="text-xs text-areia/65">Cauções e reservas</p></div>
            </div>
            {account.loading ? <Skeleton className="h-8 w-28 bg-white/10" /> : <Kz value={account.data?.heldBalance} className="text-2xl" />}
          </div>
        </div>
      </section>
      {account.error && <ErrorState message={account.error} onRetry={account.reload} />}

      <BackendPending what="Levantar o saldo para IBAN ou Multicaixa Express (e guardar os dados para receber) ainda não existe." />

      <Card className="overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 font-titulo text-lg font-bold text-verde">Movimentos</h2>
        {statement.error ? (
          <ErrorState message={statement.error} onRetry={statement.reload} />
        ) : statement.loading ? (
          <div className="p-4"><ListSkeleton rows={3} /></div>
        ) : entries.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem movimentos" text="Os pagamentos, cauções e alugueres recebidos aparecem aqui." />
        ) : (
          <ul>
            {entries.map((e) => {
              const credit = Number(e.amount) > 0 && !["PAYMENT_DEBIT", "SERVICE_FEE", "HOLD", "DEPOSIT_HOLD"].includes(e.type);
              return (
                <li key={e.id} className="flex items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", credit ? "bg-salvia-tint text-verde-medio" : "bg-areia-2 text-mel")}>
                    {credit ? <ArrowDownLeft className="size-5" strokeWidth={1.8} aria-hidden /> : <ArrowUpRight className="size-5" strokeWidth={1.8} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-verde">{ENTRY_LABEL[e.type] ?? e.type}</p>
                    <p className="truncate text-[13px] text-cinza">{e.description ?? formatDateTime(e.createdAt)}</p>
                  </div>
                  <span className={cn("num font-titulo font-bold whitespace-nowrap", credit ? "text-verde-medio" : "text-verde")}>
                    {credit ? "+" : "−"}
                    {Math.abs(Math.round(Number(e.amount))).toLocaleString("de-DE")} Kz
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
