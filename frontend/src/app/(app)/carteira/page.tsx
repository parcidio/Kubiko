"use client";

import { ArrowDownLeft, ArrowUpRight, Lock, Wallet } from "lucide-react";
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
  const account = useResource(session ? "account" : null, () => walletApi.account());
  const statement = useResource(session ? "statement" : null, () => walletApi.statement());

  if (!session) return null;
  const entries = statement.data?.content ?? [];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Carteira" subtitle="O que recebeste e o que está retido." />

      <section className="relative overflow-hidden rounded-sheet bg-verde p-6 text-areia">
        <HexGlow />
        <div className="relative grid gap-5 sm:grid-cols-2">
          <div>
            <Eyebrow className="text-salvia">Disponível</Eyebrow>
            {account.loading ? <Skeleton className="mt-2 h-12 w-48 bg-white/10" /> : <Kz value={account.data?.availableBalance} className="text-[44px] leading-tight text-ambar" />}
          </div>
          <div>
            <Eyebrow className="flex items-center gap-1.5 text-salvia">
              <Lock className="size-3.5" strokeWidth={2} aria-hidden /> Retido (cauções e reservas)
            </Eyebrow>
            {account.loading ? <Skeleton className="mt-2 h-10 w-36 bg-white/10" /> : <Kz value={account.data?.heldBalance} className="text-[32px] leading-tight" />}
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
