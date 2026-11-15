"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Banknote, CheckCircle2, FileText, HandCoins, Landmark, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";
import { PriceSummary } from "@/components/bz/booking";
import { HexIllustration } from "@/components/bz/brand";
import { Checkbox } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Callout, Card, Eyebrow, Kz, Skeleton } from "@/components/bz/ui";
import { ApiError, bookingApi, contractApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { PAID_STATUSES, bookingCode, firstName } from "@/lib/booking";
import { daysBetween, formatDay, SERVICE_FEE_RATE } from "@/lib/format";
import { CHANNEL_LABEL, type Booking, type Contract, type DirectChannel } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

const CHANNELS: { value: DirectChannel; icon: LucideIcon }[] = [
  { value: "CASH", icon: Banknote },
  { value: "TRANSFER", icon: Landmark },
  { value: "MULTICAIXA_EXPRESS", icon: Smartphone },
];

/**
 * Pagamento direto ao dono, na entrega (decisoes-produto.md 2026-11-15, modelo "Yango").
 * Arrendatário: quanto e como pagar, e as regras. Dono: confirmar que recebeu → reserva paga + comprovativo.
 */
export default function PagarPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const contract = useResource<Contract | null>(
    session && booking.data?.status === "ACCEPTED" ? `contract:${id}` : null,
    () => contractApi.get(id).catch((e) => (e instanceof ApiError && e.status === 409 ? null : Promise.reject(e))),
  );
  const [channel, setChannel] = useState<DirectChannel | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!session) return null;
  const err = booking.error ?? contract.error;
  if (err) return <ErrorState message={err} onRetry={() => { booking.reload(); contract.reload(); }} />;
  if (!booking.data || (booking.data.status === "ACCEPTED" && contract.loading)) {
    return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  }

  const b = booking.data;
  const as = b.ownerId === session.profileId ? "owner" : "renter";
  const days = daysBetween(b.startDate, b.endDate);
  const rental = Number(b.totalPrice);
  const fee = Math.round(rental * SERVICE_FEE_RATE);
  const deposit = Number(b.depositAmount);
  const total = rental + fee + deposit;

  if (b.status !== "ACCEPTED") {
    const paid = PAID_STATUSES.includes(b.status);
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={CheckCircle2} tone={paid ? "ok" : "areia"} size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">{paid ? "Pagamento registado" : "Nada para pagar agora"}</h1>
        <p className="text-cinza">
          {paid ? "O comprovativo está na reserva. O próximo passo é a checklist de entrega." : "Só se paga depois de o dono aceitar o pedido, na entrega."}
        </p>
        <ButtonLink href={`/reservas/${id}`} variant="dark">
          Ver reserva
        </ButtonLink>
      </div>
    );
  }

  const contractAccepted = !!contract.data?.renterAcceptedAt;

  if (as === "renter" && !contractAccepted) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={FileText} tone="ambar" size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">Primeiro, o contrato</h1>
        <p className="text-cinza">Antes do levantamento, lê e aceita o contrato. Diz como se paga, o que acontece à caução e o que fazer se houver um problema.</p>
        <ButtonLink href={`/reservas/${id}/contrato`} block size="lg">
          Ler e aceitar o contrato
        </ButtonLink>
        <BackLink href={`/reservas/${id}`}>Voltar à reserva</BackLink>
      </div>
    );
  }

  async function confirmReceived() {
    if (!channel) return;
    setBusy(true);
    try {
      booking.setData(await paymentApi.received(id, channel));
      toast.success("Pagamento registado. Enviámos o comprovativo ao arrendatário.");
      router.replace(`/reservas/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  const hero = (
    <section className="relative overflow-hidden rounded-sheet bg-verde p-6 text-areia">
      <div className="hex-bg absolute inset-0 opacity-60" aria-hidden />
      <div className="relative grid gap-2">
        <Eyebrow className="text-salvia">{as === "owner" ? "Recebes na entrega" : "Pagas ao dono, na entrega"}</Eyebrow>
        <Kz value={total} className="text-[44px] leading-none text-ambar md:text-[56px]" />
        <p className="text-areia/80">
          {b.itemTitle} · levantamento a {formatDay(b.startDate)}
          {deposit > 0 && " · inclui caução reembolsável"}
        </p>
      </div>
    </section>
  );

  if (as === "owner") {
    return (
      <div className="mx-auto grid max-w-2xl gap-5 pb-24">
        <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
        {hero}

        {!contractAccepted ? (
          <Callout tone="warn" title={`${firstName(b.renterName)} ainda não aceitou o contrato`}>
            Só podes registar o pagamento depois disso. Avisamos-te quando aceitar; podes lembrá-lo quando combinarem o levantamento.
          </Callout>
        ) : (
          <>
            <Card className="grid gap-4 p-5">
              <h2 className="font-titulo text-lg font-bold text-verde">Na entrega</h2>
              <Steps
                items={[
                  `Mostra o equipamento a ${firstName(b.renterName)} e deixa-o conferir.`,
                  `Recebe ${formatKzPlain(total)}${deposit > 0 ? `, com ${formatKzPlain(deposit)} de caução que lhe devolves no fim` : ""}.`,
                  "Confirma aqui que recebeste. A reserva fica paga e o comprovativo sai para as duas partes.",
                  "Fazem juntos a checklist de entrega, com fotos.",
                ]}
              />
            </Card>

            <Card className="grid gap-4 p-5">
              <fieldset className="grid gap-3">
                <legend className="mb-2 font-titulo text-lg font-bold text-verde">Como recebeste?</legend>
                {CHANNELS.map(({ value, icon: Icon }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-campo border-2 px-4 transition",
                      channel === value ? "border-verde bg-salvia-tint/60" : "border-borda hover:border-borda-forte",
                    )}
                  >
                    <input type="radio" name="channel" value={value} checked={channel === value} onChange={() => setChannel(value)} className="sr-only" />
                    <Icon className="size-5 text-mel" strokeWidth={1.8} aria-hidden />
                    <span className="flex-1 font-medium text-verde">{CHANNEL_LABEL[value]}</span>
                    <span className={cn("size-5 rounded-full border-2", channel === value ? "border-[6px] border-verde" : "border-borda-forte")} aria-hidden />
                  </label>
                ))}
              </fieldset>
              <Checkbox checked={confirmed} onChange={setConfirmed}>
                Confirmo que recebi {formatKzPlain(total)} de {b.renterName}
                {deposit > 0 ? `, incluindo ${formatKzPlain(deposit)} de caução que devolvo no fim` : ""}.
              </Checkbox>
            </Card>

            <Callout tone="ok" icon={HandCoins} title="Taxa de serviço">
              Dos {formatKzPlain(total)}, {formatKzPlain(fee)} são a taxa de serviço da Beeznoo. Fica registada na tua Carteira e a equipa combina contigo como a entregas.
            </Callout>

            <StickyCTA>
              <Button block size="lg" disabled={!channel || !confirmed} loading={busy} onClick={confirmReceived}>
                Confirmar que recebi
              </Button>
            </StickyCTA>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      {hero}

      <Card className="grid gap-4 p-5">
        <h2 className="font-titulo text-lg font-bold text-verde">Como funciona</h2>
        <Steps
          items={[
            `Combina com ${firstName(b.ownerName)} a hora e o local do levantamento.`,
            "Confere o equipamento antes de pagar: liga-o, vê se está tudo.",
            "Paga ao dono em numerário, transferência ou Multicaixa Express.",
            "O dono confirma na app e recebes o comprovativo. Depois fazem a checklist de entrega com fotos.",
          ]}
        />
      </Card>

      <Callout tone="warn" title="Nunca pagues antes do encontro">
        Ninguém da Beeznoo te pede pagamentos antecipados nem dados do cartão. Se alguém pedir, não pagues e fala connosco.
      </Callout>

      {deposit > 0 && (
        <Callout tone="ok" icon={ShieldCheck} title="A caução volta para ti">
          Os {formatKzPlain(deposit)} de caução ficam com o dono durante o aluguer. Ele devolve-os no fim, depois de confirmarem a devolução. Se não concordares com uma retenção, reporta um problema até 7 dias depois.
        </Callout>
      )}

      <Card className="p-5">
        <PriceSummary pricePerDay={days ? rental / days : 0} days={days} deposit={deposit} />
      </Card>

      <ButtonLink href={`/reservas/${id}`} variant="outline" block size="lg">
        Voltar à reserva
      </ButtonLink>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((s, i) => (
        <li key={s} className="flex items-start gap-3">
          <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-areia-2 font-titulo font-bold text-verde">{i + 1}</span>
          <span className="pt-1">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function formatKzPlain(v: number) {
  return `${Math.round(v).toLocaleString("de-DE")} Kz`;
}
