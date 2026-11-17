"use client";

import { formatFeeRate, useServiceFeeRate } from "@/lib/fee";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Banknote, FileText, HandCoins, Landmark, ShieldAlert, ShieldCheck, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/bz/form";
import { HexTile } from "@/components/bz/hex";
import { toast } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { SuccessCheck } from "@/components/bz/success";
import { SegmentedControl } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Eyebrow, Kz, Skeleton } from "@/components/bz/ui";
import { ApiError, bookingApi, contractApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { PAID_STATUSES, bookingCode, firstName } from "@/lib/booking";
import { daysBetween, formatDay } from "@/lib/format";
import { type Booking, type Contract, type DirectChannel } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

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
  const feeRate = useServiceFeeRate(); // PAYMENTS_SERVICE_FEE_RATE, via API
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
  const lang = useLang();
  const dict = useT();
  const t = dict.pay;
  const bp = dict.bookingPage;

  if (!session) return null;
  const err = booking.error ?? contract.error;
  if (err) return <ErrorState message={err} onRetry={() => { booking.reload(); contract.reload(); }} />;
  if (!booking.data || (booking.data.status === "ACCEPTED" && contract.loading)) {
    return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;
  }

  const b = booking.data;
  const as = b.ownerId === session.profileId ? "owner" : "renter";
  const days = daysBetween(b.startDate, b.endDate);
  const rental = Number(b.totalPrice);
  const fee = Math.round(rental * feeRate);
  const deposit = Number(b.depositAmount);
  const total = rental + fee + deposit;

  if (b.status !== "ACCEPTED") {
    const paid = PAID_STATUSES.includes(b.status);
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        {paid ? <SuccessCheck /> : <HexTile icon={Wallet} tone="areia" size={72} />}
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde md:text-[32px]">{paid ? t.paidTitle : t.nothingTitle}</h1>
        <p className="text-cinza">
          {paid ? t.paidText : t.nothingText}
        </p>
        <ButtonLink href={`/reservas/${id}`} variant="dark">
          {bp.seeBooking}
        </ButtonLink>
      </div>
    );
  }

  const contractAccepted = !!contract.data?.renterAcceptedAt;

  if (as === "renter" && !contractAccepted) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexTile icon={FileText} tone="ambar-tint" size={72} />
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde md:text-[32px]">{t.contractFirst}</h1>
        <p className="text-cinza">{t.contractFirstText}</p>
        <ButtonLink href={`/reservas/${id}/contrato`} block size="lg">
          {t.readContract}
        </ButtonLink>
        <BackLink href={`/reservas/${id}`}>{bp.backToBooking}</BackLink>
      </div>
    );
  }

  async function confirmReceived() {
    if (!channel) return;
    setBusy(true);
    try {
      booking.setData(await paymentApi.received(id, channel));
      toast.success(t.registered);
      router.replace(`/reservas/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.registerError);
    } finally {
      setBusy(false);
    }
  }

  const daysLabel = plural(days, dict.common.days);
  const rows: [string, number][] =
    as === "owner"
      ? [
          [fmt(t.ownerRental, { days: daysLabel }), rental],
          ...(deposit > 0 ? ([[t.ownerDeposit, deposit]] as [string, number][]) : []),
          [t.ownerFee, fee],
        ]
      : [
          [fmt(t.renterRental, { days: daysLabel }), rental],
          [fmt(t.renterFee, { rate: formatFeeRate(feeRate, lang) }), fee],
          ...(deposit > 0 ? ([[t.renterDeposit, deposit]] as [string, number][]) : []),
        ];

  const hero = (
    <section className="superficie-marca relative animate-sobe overflow-hidden rounded-sheet bg-verde p-5 text-areia md:p-6">
      <div className="hex-bg absolute inset-0 opacity-60" aria-hidden />
      <div className="relative grid gap-1">
        <Eyebrow className="text-salvia">{as === "owner" ? fmt(t.receiveFrom, { name: firstName(b.renterName, dict) }) : fmt(t.payTo, { name: firstName(b.ownerName, dict) })}</Eyebrow>
        <Kz value={total} className="text-[38px] leading-none text-white md:text-[48px]" />
        <p className="mt-1 text-[15px] text-salvia-tint">
          {fmt(t.pickupOn, { title: b.itemTitle, day: formatDay(b.startDate, false, lang) })}
        </p>
        <dl className="mt-3 grid border-t border-salvia/25 pt-2 text-sm text-salvia-tint">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 py-1">
              <dt>{label}</dt>
              <dd className="num font-bold whitespace-nowrap">{formatKzPlain(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );

  if (as === "owner") {
    return (
      <div className="mx-auto grid max-w-2xl gap-5 pb-24">
        <BackLink href={`/reservas/${id}`}>{fmt(bp.bookingCode, { code: bookingCode(id) })}</BackLink>
        {hero}

        {!contractAccepted ? (
          <Callout tone="warn" title={fmt(t.notAcceptedTitle, { name: firstName(b.renterName, dict) })}>
            {t.notAcceptedText}
          </Callout>
        ) : (
          <>
            <Card className="grid gap-4 p-5">
              <h2 className="font-titulo text-lg font-bold text-verde">{t.atHandover}</h2>
              <Steps
                items={t.ownerSteps.map((s) =>
                  fmt(s, {
                    renter: firstName(b.renterName, dict),
                    total: formatKzPlain(total),
                    depositPart: deposit > 0 ? fmt(t.ownerStepsDeposit, { deposit: formatKzPlain(deposit) }) : "",
                  }),
                )}
              />
            </Card>

            <Card className="grid gap-4 p-5">
              <div className="grid gap-2">
                <h2 className="font-titulo text-lg font-bold text-verde">{t.howReceived}</h2>
                <SegmentedControl
                  label={t.howReceived}
                  value={channel as DirectChannel}
                  onChange={setChannel}
                  options={CHANNELS.map(({ value, icon }) => ({ value, label: dict.channel[value], icon }))}
                  className="max-sm:grid-flow-row max-sm:auto-rows-fr"
                />
              </div>
              <Checkbox checked={confirmed} onChange={setConfirmed}>
                {fmt(t.confirmReceived, {
                  total: formatKzPlain(total),
                  name: b.renterName,
                  depositPart: deposit > 0 ? fmt(t.confirmReceivedDeposit, { deposit: formatKzPlain(deposit) }) : "",
                })}
              </Checkbox>
            </Card>

            <Callout tone="info" icon={HandCoins} title={t.feeTitle}>
              {fmt(t.feeText, { total: formatKzPlain(total), fee: formatKzPlain(fee) })}
            </Callout>

            <StickyCTA>
              <Button block size="lg" disabled={!channel || !confirmed} loading={busy} onClick={confirmReceived}>
                {t.confirmButton}
              </Button>
            </StickyCTA>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <BackLink href={`/reservas/${id}`}>{fmt(bp.bookingCode, { code: bookingCode(id) })}</BackLink>
      {hero}

      <Card className="grid gap-4 p-5">
        <h2 className="font-titulo text-lg font-bold text-verde">{t.howItWorks}</h2>
        <Steps
          items={t.renterSteps.map((s) => fmt(s, { owner: firstName(b.ownerName, dict) }))}
        />
      </Card>

      <Callout tone="erro" icon={ShieldAlert} title={t.neverPayTitle}>
        {t.neverPayText}
      </Callout>

      {deposit > 0 && (
        <Callout tone="ok" icon={ShieldCheck} title={t.depositBackTitle}>
          {fmt(t.depositBackText, { deposit: formatKzPlain(deposit) })}
        </Callout>
      )}

      <ButtonLink href={`/reservas/${id}`} variant="outline" block size="lg">
        {bp.backToBooking}
      </ButtonLink>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-3">
      {items.map((s, i) => (
        <li key={s} className="flex items-start gap-3">
          <HexTile size={34} className="num">{i + 1}</HexTile>
          <span className="pt-1.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function formatKzPlain(v: number) {
  return `${Math.round(v).toLocaleString("de-DE")} Kz`;
}
