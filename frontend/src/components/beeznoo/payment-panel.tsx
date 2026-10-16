"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, paymentApi } from "@/lib/api";
import { formatKz } from "@/lib/format";
import type { Booking, Payment } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

function ReferenceRow({ label, value, copy }: { label: string; value: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-borda py-3 last:border-0">
      <div>
        <p className="text-xs tracking-[0.1em] text-cinza uppercase">{label}</p>
        <p className="font-heading text-xl text-verde tabular-nums">{value}</p>
      </div>
      {copy && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Copiar ${label.toLowerCase()}`}
          onClick={() => navigator.clipboard.writeText(copy).then(() => toast.success(`${label} copiada.`))}
        >
          <Copy strokeWidth={1.8} />
        </Button>
      )}
    </div>
  );
}

/** Pagamento por referência (Multicaixa Express / ATM). Validação simulada no MVP; EMIS mais tarde. */
export function PaymentPanel({ booking, onPaid }: { booking: Booking; onPaid: () => void }) {
  // undefined = a carregar · null = ainda sem referência
  const current = useResource<Payment | null>(`payment:${booking.id}`, () =>
    paymentApi.current(booking.id).then(
      (p) => p ?? null,
      (e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      },
    ),
  );
  const payment = current.data;
  const setPayment = current.setData;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const error = current.error ?? actionError;

  async function generate() {
    setBusy(true);
    setActionError("");
    try {
      setPayment(await paymentApi.create(booking.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível gerar a referência.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!payment) return;
    setBusy(true);
    try {
      const p = await paymentApi.check(payment.id);
      setPayment(p);
      if (p.status === "CONFIRMED") {
        toast.success("Pagamento confirmado.");
        onPaid();
      } else {
        toast("Ainda não recebemos o pagamento. Pode levar alguns minutos.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setBusy(false);
    }
  }

  const expired = payment?.status === "EXPIRED" || payment?.status === "FAILED" || payment?.status === "CANCELLED";

  return (
    <section className="grid gap-4 rounded-bz-md border border-borda bg-branco p-4" aria-labelledby="t-pay">
      <div className="grid gap-1">
        <h2 id="t-pay" className="font-heading text-lg text-verde">Pagamento</h2>
        <p className="text-sm text-cinza">O dono aceitou. Paga por referência no Multicaixa Express ou num ATM.</p>
      </div>

      {payment === undefined && !error && <Skeleton role="status" aria-label="A carregar" className="h-32" />}
      {error && <p role="alert" className="text-sm text-erro">{error}</p>}

      {payment && payment.entity && payment.reference && !expired && (
        <>
          <div className="rounded-bz-md bg-areia px-3">
            <ReferenceRow label="Entidade" value={payment.entity} copy={payment.entity} />
            {/* referência agrupada 3-3-3 para ler no ATM */}
            <ReferenceRow label="Referência" value={payment.reference.replace(/(\d{3})(?=\d)/g, "$1 ")} copy={payment.reference} />
            <ReferenceRow label="Montante" value={formatKz(payment.amount)} />
          </div>
          <p className="text-[13px] text-cinza">
            Válida até {new Date(payment.expiresAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}.
          </p>
          <Button onClick={check} disabled={busy} className="w-full">
            {busy ? "A verificar…" : "Já paguei"}
          </Button>
        </>
      )}

      {(payment === null || expired) && (
        <>
          {expired && <p className="text-sm text-aviso-texto">A referência anterior expirou. Gera uma nova para pagar.</p>}
          <Button onClick={generate} disabled={busy} className="w-full">
            {busy ? "A gerar…" : "Gerar referência de pagamento"}
          </Button>
        </>
      )}
    </section>
  );
}
