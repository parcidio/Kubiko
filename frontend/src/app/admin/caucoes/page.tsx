"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import {
  AdminBookingLink, AdminHeader, BookingEvidence, BookingStatusBadge, ConfirmWithReason, QueueRow, QueueStates, age,
} from "@/components/bz/admin";
import { MoneyField, RadioCards } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { EmptyState } from "@/components/bz/states";
import { Card, Button, Callout, Kz } from "@/components/bz/ui";
import { adminApi, incidentApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import { formatDateTime, formatKz } from "@/lib/format";
import type { Deposit, Incident, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Decision = "release" | "withhold";

function CaucoesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("booking");
  const queue = useResource<Page<Deposit>>("admin:deposits", () => adminApi.deposits());
  const rows = queue.data?.content ?? [];
  const selected = rows.find((d) => d.bookingId === selectedId) ?? null;
  const select = (bookingId: string | null) => router.replace(bookingId ? `/admin/caucoes?booking=${bookingId}` : "/admin/caucoes", { scroll: false });

  return (
    <div className="grid max-w-7xl gap-6">
      <AdminHeader
        title="Cauções"
        text="Reservas devolvidas ou com problema, a mais antiga primeiro. Compara a entrega com a devolução antes de decidir: a decisão conclui a reserva e não se desfaz."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-borda bg-areia px-4 py-3">
            <p className="text-xs font-bold tracking-[0.1em] text-cinza uppercase">Na fila</p>
            {queue.data && <p className="num text-sm font-bold text-verde">{queue.data.page?.totalElements ?? queue.data.content.length}</p>}
          </div>
          <QueueStates
            loading={!queue.data}
            error={queue.error}
            empty={rows.length === 0}
            onRetry={queue.reload}
            emptyTitle="Sem cauções por decidir"
            emptyText="Aparecem aqui quando uma devolução é confirmada ou quando é reportado um problema."
          />
          {rows.map((d) => (
            <QueueRow
              key={d.id}
              selected={d.bookingId === selectedId}
              onSelect={() => select(d.bookingId)}
              title={d.itemTitle}
              badge={<BookingStatusBadge status={d.bookingStatus} />}
              meta={<>{bookingCode(d.bookingId)} · {d.renterName} → {d.ownerName} · retida {age(d.heldAt)}</>}
              aside={<Kz value={d.amount} className="text-lg text-verde" />}
            />
          ))}
        </Card>

        <div className="lg:sticky lg:top-6">
          {selected ? (
            <DepositPanel key={selected.id} deposit={selected} onDone={() => { select(null); queue.reload(); }} />
          ) : selectedId && queue.data ? (
            <Card><EmptyState icon={ShieldCheck} title="Esta caução já não está na fila" text="Foi decidida ou a reserva ainda não foi devolvida." /></Card>
          ) : (
            <Card><EmptyState icon={ShieldCheck} title="Escolhe uma caução" text="Vês aqui as fotos da entrega e da devolução, os problemas e a decisão." /></Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCaucoes() {
  return (
    <Suspense>
      <CaucoesInner />
    </Suspense>
  );
}

function DepositPanel({ deposit, onDone }: { deposit: Deposit; onDone: () => void }) {
  const [decision, setDecision] = useState<Decision>("release");
  const [amount, setAmount] = useState<number | "">("");
  const [confirming, setConfirming] = useState(false);
  const incidents = useResource<Incident[]>(`incidents:${deposit.bookingId}`, () => incidentApi.list(deposit.bookingId));
  const open = (incidents.data ?? []).filter((i) => i.status === "OPEN");

  const total = Math.round(Number(deposit.amount));
  const withheld = decision === "release" ? 0 : amount === "" ? 0 : amount;
  const amountError = decision === "withhold" && (amount === "" || amount < 1 || amount > total) ? `Entre 1 e ${formatKz(total)}.` : undefined;

  async function run(reason: string) {
    const result =
      decision === "release"
        ? await adminApi.releaseDeposit(deposit.bookingId, reason)
        : await adminApi.withholdDeposit(deposit.bookingId, withheld, reason);
    toast.success(
      result.status === "RELEASED"
        ? `${bookingCode(deposit.bookingId)}: caução libertada, reserva concluída.`
        : `${bookingCode(deposit.bookingId)}: ${formatKz(withheld)} para o dono, reserva concluída.`,
    );
    onDone();
  }

  return (
    <Card className="grid gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-[13px] text-cinza">
            <AdminBookingLink bookingId={deposit.bookingId}>Reserva {bookingCode(deposit.bookingId)} <ExternalLink className="inline size-3.5" aria-hidden /></AdminBookingLink>
            {" · "}retida em {formatDateTime(deposit.heldAt)}
          </p>
          <h2 className="font-titulo text-2xl font-bold text-verde">{deposit.itemTitle}</h2>
          <p className="text-[15px]">
            Arrendatário <span className="font-bold">{deposit.renterName}</span> · dono <span className="font-bold">{deposit.ownerName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-cinza">Caução</p>
          <Kz value={deposit.amount} className="text-3xl text-verde" />
        </div>
      </div>

      {open.length > 0 && (
        <Callout tone="warn" icon={AlertTriangle} title={`${open.length} problema(s) por resolver`}>
          Resolve primeiro em <Link href="/admin/problemas" className="font-bold underline">Problemas</Link>: a nota explica a decisão às duas partes.
        </Callout>
      )}

      <BookingEvidence bookingId={deposit.bookingId} />

      <div className="grid gap-4 border-t border-borda pt-5">
        <RadioCards<Decision>
          legend="Decisão"
          name={`decision-${deposit.id}`}
          value={decision}
          onChange={setDecision}
          columns={2}
          options={[
            { value: "release", title: "Libertar tudo", text: "Sem dano: a caução volta inteira ao arrendatário" },
            { value: "withhold", title: "Reter", text: "Parte ou tudo vai para o dono (dano, perda, roubo)" },
          ]}
        />
        {decision === "withhold" && (
          <div className="grid gap-2">
            <MoneyField label="Valor que fica para o dono" value={amount} onChange={setAmount} error={amountError} hint="Kwanzas inteiros." />
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setAmount(total)}>
              Reter a caução toda ({formatKz(total)})
            </Button>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 rounded-cartao bg-areia p-4">
          <div>
            <dt className="text-[13px] text-cinza">Volta ao arrendatário</dt>
            <dd><Kz value={total - withheld} className="text-xl text-verde" /></dd>
          </div>
          <div>
            <dt className="text-[13px] text-cinza">Fica para o dono</dt>
            <dd><Kz value={withheld} className="text-xl text-verde" /></dd>
          </div>
        </dl>
        <Button variant="dark" size="lg" block disabled={!!amountError} onClick={() => setConfirming(true)}>
          {decision === "release" ? "Libertar caução" : `Reter ${formatKz(withheld)}`}
        </Button>
      </div>

      <ConfirmWithReason
        open={confirming}
        onClose={() => setConfirming(false)}
        title={decision === "release" ? "Libertar a caução?" : "Reter a caução?"}
        confirmLabel={decision === "release" ? "Sim, libertar" : "Sim, reter"}
        danger={decision === "withhold"}
        onConfirm={run}
        placeholder={decision === "release" ? "Ex.: fotos da devolução iguais às da entrega." : "Ex.: risco no ecrã visível na foto 2 da devolução."}
      >
        <p>
          {decision === "release"
            ? `${formatKz(total)} voltam a ${deposit.renterName}.`
            : `${formatKz(withheld)} vão para ${deposit.ownerName} e ${formatKz(total - withheld)} voltam a ${deposit.renterName}.`}{" "}
          A reserva fica concluída{decision === "withhold" ? " e as duas partes recebem o motivo" : "; o motivo fica na auditoria"}. Não dá para desfazer.
        </p>
      </ConfirmWithReason>
    </Card>
  );
}
