"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { HexIllustration } from "@/components/bz/brand";
import { Checkbox, TextField } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Kz, Skeleton } from "@/components/bz/ui";
import { bookingApi, paymentApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { bookingCode, firstName } from "@/lib/booking";
import type { Booking } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

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

  if (!session) return null;
  if (booking.error) return <ErrorState message={booking.error} onRetry={booking.reload} />;
  if (!booking.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;

  const b = booking.data;
  const deposit = Number(b.depositAmount);
  const isOwner = b.ownerId === session.profileId;

  if (!isOwner || b.status !== "RETURNED") {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={CheckCircle2} tone="areia" size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">Nada a registar agora</h1>
        <p className="text-cinza">
          {isOwner
            ? "A caução regista-se depois de a devolução ser confirmada pelas duas partes."
            : "É o dono que regista a devolução da caução."}
        </p>
        <ButtonLink href={`/reservas/${id}`} variant="dark">
          Ver reserva
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
      toast.success("Caução registada. A reserva está concluída.");
      router.replace(`/reservas/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar a caução.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-24">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      <PageHeader title="Devolver a caução" subtitle={`${b.itemTitle} · ${firstName(b.renterName)}`} />

      <Card className="grid gap-2 p-5">
        <p className="text-sm text-cinza">Caução que recebeste na entrega</p>
        <Kz value={deposit} className="text-3xl text-verde" />
      </Card>

      <Segmented
        label="O que fizeste com a caução"
        value={mode}
        onChange={setMode}
        options={[
          { value: "all", label: "Devolvi tudo" },
          { value: "partial", label: "Retive uma parte" },
        ]}
      />

      {mode === "partial" && (
        <Card className="grid gap-4 p-5">
          <TextField
            label="Valor retido (Kz)"
            value={withheld}
            onChange={(v) => setWithheld(v.replace(/\D/g, "").slice(0, 9))}
            inputMode="numeric"
            placeholder="Ex.: 5000"
            error={withheld && invalidAmount ? `Entre 1 e ${deposit.toLocaleString("de-DE")} Kz` : undefined}
          />
          <TextField
            label="Motivo"
            value={reason}
            onChange={setReason}
            placeholder="Ex.: risco na lente que não estava na entrega"
            hint="O arrendatário vê este motivo. Usa as fotos da checklist para o explicar."
          />
          {!invalidAmount && amount > 0 && (
            <p className="text-sm text-texto-corpo">
              Devolves {returned.toLocaleString("de-DE")} Kz e ficas com {amount.toLocaleString("de-DE")} Kz.
            </p>
          )}
        </Card>
      )}

      <Callout tone="ok" icon={ShieldCheck} title="Se houver desacordo">
        {firstName(b.renterName)} pode reportar um problema até 7 dias depois. A equipa Beeznoo compara as fotos da entrega e da devolução e decide.
      </Callout>

      <Checkbox checked={confirmed} onChange={setConfirmed}>
        {mode === "all"
          ? `Confirmo que devolvi os ${deposit.toLocaleString("de-DE")} Kz de caução a ${b.renterName}.`
          : `Confirmo que devolvi ${Math.max(returned, 0).toLocaleString("de-DE")} Kz a ${b.renterName} e retive o resto pelo motivo indicado.`}
      </Checkbox>

      <StickyCTA>
        <Button block size="lg" disabled={!ready} loading={busy} onClick={submit}>
          Registar e concluir
        </Button>
      </StickyCTA>
    </div>
  );
}
