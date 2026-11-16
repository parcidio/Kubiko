"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, HandCoins, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { HexGlow } from "@/components/bz/brand";
import { HexTile } from "@/components/bz/hex";
import { PageHeader } from "@/components/bz/shell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Badge, Callout, Card, Kz, Skeleton } from "@/components/bz/ui";
import { paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/**
 * Pagamento direto (decisoes-produto.md 2026-11-15): o dono recebe na entrega e entrega a taxa de serviço à Beeznoo.
 * A Carteira mostra o que recebeu e a taxa por entregar. A Beeznoo não guarda dinheiro: não há saldo a levantar.
 */
export default function CarteiraPage() {
  const session = useRequireSession();
  const router = useRouter();
  const data = useResource(session ? "commissions:me" : null, () => paymentApi.myCommissions());

  if (!session) return null;
  const lines = data.data?.lines ?? [];
  const due = Number(data.data?.due ?? 0);
  const received = lines.reduce((s, l) => s + Number(l.rentalAmount), 0);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline"
      >
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
        Voltar
      </button>
      <PageHeader title="Carteira" subtitle="O que recebeste na entrega e a taxa de serviço por entregar à Beeznoo." />

      <section className="superficie-marca relative overflow-hidden rounded-sheet bg-verde-noite p-5 text-areia md:p-8">
        <HexGlow />
        <div className="relative grid gap-4 md:grid-cols-2">
          <div className="grid gap-1 rounded-cartao border border-white/10 bg-white/5 p-4">
            <p className="flex items-center gap-2.5 text-sm font-bold text-white">
              <HexTile icon={HandCoins} tone="salvia" size={32} /> Taxa por entregar
            </p>
            {data.loading ? <Skeleton className="h-9 w-40 bg-white/10" /> : <Kz value={due} className="mt-1 text-[34px] leading-none text-white" />}
            <p className="text-[13px] text-salvia-tint">{due > 0 ? "A equipa Beeznoo contacta-te para combinar a entrega." : "Não deves nada à Beeznoo."}</p>
          </div>
          <div className="grid gap-1 rounded-cartao border border-white/10 bg-white/5 p-4">
            <p className="flex items-center gap-2.5 text-sm font-bold text-white">
              <HexTile icon={Wallet} tone="salvia" size={32} /> Alugueres recebidos
            </p>
            {data.loading ? <Skeleton className="h-9 w-40 bg-white/10" /> : <Kz value={received} className="mt-1 text-[34px] leading-none text-white" />}
            <p className="text-[13px] text-salvia-tint">O que ficou para ti: o aluguer, sem a taxa de serviço nem as cauções (que devolves).</p>
          </div>
        </div>
      </section>

      <Callout tone="info" title="Como funciona">
        O arrendatário paga-te na entrega (aluguer + taxa de serviço + caução). Ficas com o aluguer, devolves a caução no fim e entregas a taxa de serviço à Beeznoo.
      </Callout>

      <Card className="overflow-hidden">
        <h2 className="border-b border-borda px-4 py-3 font-titulo text-lg font-bold text-verde">Pagamentos recebidos</h2>
        {data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : data.loading ? (
          <div className="p-4"><ListSkeleton rows={3} /></div>
        ) : lines.length === 0 ? (
          <EmptyState icon={Wallet} title="Ainda sem pagamentos" text="Quando confirmares que recebeste um pagamento na entrega, aparece aqui." />
        ) : (
          <ul>
            {lines.map((l) => (
              <li key={l.paymentId} className="border-b border-borda last:border-0">
                <Link href={`/reservas/${l.bookingId}`} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-areia">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="truncate font-titulo font-bold text-verde">{l.itemTitle}</p>
                    <p className="truncate text-[13px] text-cinza">
                      {formatDateTime(l.confirmedAt)}
                      {l.channel ? ` · ${CHANNEL_LABEL[l.channel]}` : ""}
                      {l.receiptNumber ? ` · ${l.receiptNumber}` : ""}
                    </p>
                    <p className="text-[13px]">
                      Taxa {Math.round(Number(l.serviceFee)).toLocaleString("de-DE")} Kz{" "}
                      {l.commissionSettledAt ? (
                        <span className="inline-flex items-center gap-1 text-verde-medio">
                          <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden /> entregue
                        </span>
                      ) : (
                        <Badge tone="pendente">por entregar</Badge>
                      )}
                    </p>
                  </div>
                  <span className="num font-titulo font-bold whitespace-nowrap text-verde">
                    {Math.round(Number(l.amountReceived)).toLocaleString("de-DE")} Kz
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-cinza transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.8} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
