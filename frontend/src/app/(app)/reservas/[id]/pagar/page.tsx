"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Copy, FileUp, Landmark, Smartphone } from "lucide-react";
import { DeadlineChip, PriceSummary } from "@/components/bz/booking";
import { HexIllustration } from "@/components/bz/brand";
import { TextField } from "@/components/bz/form";
import { copyText, toast } from "@/components/bz/overlay";
import { useLocalPhotos } from "@/components/bz/photo";
import { StickyCTA } from "@/components/bz/shell";
import { BackendPending, ErrorState } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Eyebrow, Kz, Skeleton } from "@/components/bz/ui";
import { ApiError, bookingApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode } from "@/lib/booking";
import { daysBetween, formatDateTime } from "@/lib/format";
import type { Booking, Payment } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const STEPS = {
  express: ["Abre o Multicaixa Express", "Pagamentos → Pagamento por referência", "Escreve a entidade, a referência e o montante", "Confirma e volta aqui"],
  atm: ["Num ATM, escolhe Pagamentos", "Pagamento por referência", "Escreve a entidade, a referência e o montante", "Guarda o talão e volta aqui"],
};

export default function PagarPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const current = useResource<Payment | null>(session ? `payment:${id}` : null, () =>
    paymentApi.current(id).then(
      (p) => p ?? null,
      (e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)),
    ),
  );
  const [channel, setChannel] = useState<"express" | "atm">("express");
  const [busy, setBusy] = useState(false);
  const [txId, setTxId] = useState("");
  const proof = useLocalPhotos(1);

  if (!session) return null;
  const err = booking.error ?? current.error;
  if (err) return <ErrorState message={err} onRetry={() => { booking.reload(); current.reload(); }} />;
  if (!booking.data || current.loading) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;

  const b = booking.data;
  const payment = current.data;
  const days = daysBetween(b.startDate, b.endDate);
  const closed = !payment || ["EXPIRED", "FAILED", "CANCELLED"].includes(payment.status);

  async function generate() {
    setBusy(true);
    try {
      current.setData(await paymentApi.create(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a referência.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!payment) return;
    setBusy(true);
    try {
      const p = await paymentApi.check(payment.id);
      current.setData(p);
      if (p.status === "CONFIRMED") {
        toast.success("Pagamento confirmado!");
        router.replace(`/reservas/${id}`);
      } else {
        toast("Ainda não recebemos o pagamento. Pode levar alguns minutos.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível verificar.");
    } finally {
      setBusy(false);
    }
  }

  if (b.status !== "ACCEPTED" || payment?.status === "CONFIRMED") {
    const paid = b.status === "ACTIVE" || b.status === "COMPLETED" || payment?.status === "CONFIRMED";
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={CheckCircle2} tone={paid ? "ok" : "areia"} size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">{paid ? "Pagamento confirmado" : "Nada para pagar agora"}</h1>
        <p className="text-cinza">{paid ? "As datas estão garantidas. O próximo passo é a entrega." : "Só pagas depois de o dono aceitar o pedido."}</p>
        <ButtonLink href={`/reservas/${id}`} variant="dark">
          Ver reserva
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>

      <section className="relative overflow-hidden rounded-sheet bg-verde p-6 text-areia">
        <div className="hex-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative grid gap-2">
          <Eyebrow className="text-salvia">Total a pagar</Eyebrow>
          <Kz value={payment?.amount ?? Math.round(Number(b.totalPrice) * 1.08 + Number(b.depositAmount))} className="text-[44px] leading-none text-ambar md:text-[56px]" />
          <p className="text-areia/80">{b.itemTitle} · inclui caução reembolsável</p>
          {payment && !closed && <DeadlineChip until={new Date(payment.expiresAt)} prefix="Referência válida por" className="mt-2 justify-self-start" />}
        </div>
      </section>

      {closed ? (
        <Card className="grid gap-4 p-5">
          {payment && <Callout tone="warn">A referência anterior expirou. Gera uma nova para pagar.</Callout>}
          <p>Geramos uma referência Multicaixa só para esta reserva. Pagas no Multicaixa Express ou em qualquer ATM.</p>
          <Button block size="lg" loading={busy} onClick={generate}>
            Gerar referência
          </Button>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <RefRow label="Entidade" value={payment.entity ?? "—"} copy={payment.entity ?? undefined} />
            <RefRow label="Referência" value={(payment.reference ?? "").replace(/(\d{3})(?=\d)/g, "$1 ")} copy={payment.reference ?? undefined} big />
            <RefRow label="Montante" value={`${Math.round(payment.amount).toLocaleString("de-DE")} Kz`} copy={String(Math.round(payment.amount))} />
            <p className="bg-areia px-5 py-3 text-[13px] text-cinza">Válida até {formatDateTime(payment.expiresAt)}.</p>
          </Card>

          <Card className="grid gap-4 p-5">
            <Segmented
              label="Onde pagas"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "express", label: "Multicaixa Express" },
                { value: "atm", label: "ATM" },
              ]}
            />
            <ol className="grid gap-3">
              {STEPS[channel].map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-areia-2 font-titulo font-bold text-verde">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 text-[13px] text-cinza">
              {channel === "express" ? <Smartphone className="size-4" strokeWidth={1.8} /> : <Landmark className="size-4" strokeWidth={1.8} />}
              Usa exatamente o montante indicado.
            </p>
          </Card>

          <Card className="grid gap-4 p-5">
            <h2 className="font-titulo text-lg font-bold text-verde">Comprovativo (se a equipa pedir)</h2>
            <TextField label="ID da transação" value={txId} onChange={setTxId} placeholder="Ex.: 0042 1234 5678" inputMode="numeric" />
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-campo border-2 border-dashed border-borda-forte px-4 text-verde hover:border-verde">
              <FileUp className="size-5 text-mel" strokeWidth={1.8} aria-hidden />
              <span className="flex-1 text-sm font-medium">{proof.photos[0]?.file.name ?? "Fotografia ou PDF do comprovativo"}</span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => proof.add(e.target.files)} />
            </label>
            <BackendPending what="O envio de comprovativo + ID da transação ainda não tem endpoint." />
          </Card>

          <Card className="p-5">
            <PriceSummary pricePerDay={days ? Number(b.totalPrice) / days : 0} days={days} deposit={Number(payment.depositAmount)} serviceFee={Number(payment.serviceFee)} />
          </Card>

          <StickyCTA>
            <Button block size="lg" loading={busy} onClick={check}>
              Já paguei
            </Button>
          </StickyCTA>
        </>
      )}
    </div>
  );
}

function RefRow({ label, value, copy, big }: { label: string; value: string; copy?: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4">
      <div>
        <Eyebrow>{label}</Eyebrow>
        <p className={`num font-titulo font-extrabold tracking-wider text-verde ${big ? "text-[28px]" : "text-xl"}`}>{value}</p>
      </div>
      {copy && (
        <button
          type="button"
          onClick={() => copyText(copy, label)}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-areia-2 px-4 text-sm font-bold text-verde transition hover:bg-skeleton active:scale-95"
        >
          <Copy className="size-4" strokeWidth={2} aria-hidden /> Copiar
        </button>
      )}
    </div>
  );
}
