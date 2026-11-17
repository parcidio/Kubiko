"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HandCoins, ShieldCheck } from "lucide-react";
import { Checkbox, TextField } from "@/components/bz/form";
import { HexTile } from "@/components/bz/hex";
import { toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { SegmentedControl } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Kz, Skeleton } from "@/components/bz/ui";
import { bookingApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode, firstName } from "@/lib/booking";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/**
 * Pagamento direto (decisoes-produto.md 2026-11-15): a caução está com o dono. Depois da devolução confirmada,
 * o dono indica se a devolveu toda ou se reteve parte (valor + motivo). A reserva fica concluída.
 */
export default function CaucaoPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const booking = useResource<Booking>(session ? `booking:${id}` : null, () => bookingApi.get(id));
  const [mode, setMode] = useState<"all" | "partial">("all");
  const [withheld, setWithheld] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dict = useT();
  const t = dict.deposit;
  const bp = dict.bookingPage;

  if (!session) return null;
  if (booking.error) return <ErrorState message={booking.error} onRetry={booking.reload} />;
  if (!booking.data) return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;

  const b = booking.data;
  const deposit = Number(b.depositAmount);
  const isOwner = b.ownerId === session.profileId;

  if (!isOwner || b.status !== "RETURNED") {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexTile icon={HandCoins} tone="areia" size={72} />
        <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde md:text-[32px]">{t.nothingTitle}</h1>
        <p className="text-cinza">
          {isOwner ? t.nothingOwner : t.nothingRenter}
        </p>
        <ButtonLink href={`/reservas/${id}`} variant="dark">
          {bp.seeBooking}
        </ButtonLink>
      </div>
    );
  }

  const amount = mode === "all" ? 0 : Number(withheld.replace(/\D/g, "")) || 0;
  const invalidAmount = mode === "partial" && (amount <= 0 || amount > deposit);
  const returned = deposit - amount;
  const ready = confirmed && !invalidAmount && (mode === "all" || reason.trim().length >= 5);

  async function submit() {
    setBusy(true);
    try {
      booking.setData(await paymentApi.depositDecision(id, amount, mode === "partial" ? reason.trim() : undefined));
      toast.success(t.recorded);
      router.replace(`/reservas/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.recordError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-24">
      <BackLink href={`/reservas/${id}`}>{fmt(bp.bookingCode, { code: bookingCode(id) })}</BackLink>
      <PageHeader title={t.title} subtitle={`${b.itemTitle} · ${firstName(b.renterName, dict)}`} />

      <Card className="flex items-center gap-4 p-5">
        <HexTile icon={HandCoins} tone="salvia-tint" size={48} />
        <div className="grid gap-0.5">
          <p className="text-sm text-cinza">{t.received}</p>
          <Kz value={deposit} className="text-[26px] text-verde" />
        </div>
      </Card>

      <SegmentedControl
        label={t.whatDid}
        value={mode}
        onChange={setMode}
        options={[
          { value: "all", label: t.all },
          { value: "partial", label: t.partial },
        ]}
      />

      {mode === "partial" && (
        <Card className="grid animate-sobe gap-4 p-5">
          <TextField
            label={t.withheld}
            value={withheld}
            onChange={(v) => setWithheld(v.replace(/\D/g, "").slice(0, 9))}
            inputMode="numeric"
            placeholder={t.withheldPh}
            error={withheld && invalidAmount ? fmt(t.between, { max: deposit.toLocaleString("de-DE") }) : undefined}
          />
          <TextField
            label={t.reason}
            value={reason}
            onChange={setReason}
            placeholder={t.reasonPh}
            hint={t.reasonHint}
          />
          {!invalidAmount && amount > 0 && (
            <p className="text-sm text-texto-corpo">
              {fmt(t.split, { returned: returned.toLocaleString("de-DE"), kept: amount.toLocaleString("de-DE") })}
            </p>
          )}
        </Card>
      )}

      <Callout tone="ok" icon={ShieldCheck} title={t.disagreeTitle}>
        {fmt(t.disagreeText, { name: firstName(b.renterName, dict) })}
      </Callout>

      <Checkbox checked={confirmed} onChange={setConfirmed}>
        {mode === "all"
          ? fmt(t.confirmAll, { amount: deposit.toLocaleString("de-DE"), name: b.renterName })
          : fmt(t.confirmPartial, { amount: Math.max(returned, 0).toLocaleString("de-DE"), name: b.renterName })}
      </Checkbox>

      <StickyCTA>
        <Button block size="lg" disabled={!ready} loading={busy} onClick={submit}>
          {t.submit}
        </Button>
      </StickyCTA>
    </div>
  );
}
