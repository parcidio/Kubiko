"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError, toFormErrors } from "@/components/beeznoo/auth-ui";
import { ItemPhoto, PriceSummary, StickyCTABar } from "@/components/beeznoo/booking-ui";
import { TextField } from "@/components/beeznoo/fields";
import { ErrorState } from "@/components/beeznoo/states";
import { bookingApi, catalogApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { daysBetween, formatKz, formatRange, todayIso } from "@/lib/format";
import type { Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

export default function ReservarPage() {
  const session = useRequireSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: item, error: loadError, reload } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));
  const [start, setStart] = useState(todayIso(1));
  const [end, setEnd] = useState(todayIso(2));
  const [message, setMessage] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<{ form?: string; fields: Record<string, string> }>({ fields: {} });
  const [sending, setSending] = useState(false);

  if (!session) return null;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;
  if (!item) return <Skeleton role="status" aria-label="A carregar" className="h-96" />;

  const days = daysBetween(start, end);
  const isOwnItem = item.ownerId === session.profileId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (start < todayIso()) fields.startDate = "A data de início não pode ser no passado.";
    if (days < 1) fields.endDate = "A devolução tem de ser pelo menos um dia depois do início.";
    if (!terms) fields.terms = "Tens de aceitar as condições para continuar.";
    if (Object.keys(fields).length) return setErrors({ fields });

    setSending(true);
    setErrors({ fields: {} });
    try {
      const booking = await bookingApi.create({
        itemId: id,
        startDate: start,
        endDate: end,
        renterMessage: message.trim() || undefined,
      });
      router.replace(`/reservas/${booking.id}?novo=1`);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-2xl gap-6">
      <Link href={`/equipamento/${id}`} className="flex items-center gap-1 text-sm text-mel-texto hover:underline">
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> Voltar ao equipamento
      </Link>
      <h1 className="font-heading text-[26px] text-verde md:text-[32px]">Pedir reserva</h1>

      <div className="flex gap-3 rounded-bz-md border border-borda bg-branco p-3">
        <ItemPhoto src={item.photos[0]?.photUrl} alt={item.title} className="w-24 shrink-0 rounded-bz-sm" />
        <div>
          <p className="font-heading text-lg text-verde">{item.title}</p>
          <p className="text-sm text-cinza">{formatKz(item.pricePerDay)} /dia · {item.ownerName}</p>
        </div>
      </div>

      {isOwnItem && (
        <Alert variant="warn">
          <AlertDescription className="text-current">Este equipamento é teu. Não podes reservá-lo.</AlertDescription>
        </Alert>
      )}

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Datas</legend>
        <TextField label="Levantamento" type="date" min={todayIso()} value={start} onChange={setStart} error={errors.fields.startDate} />
        <TextField label="Devolução" type="date" min={start} value={end} onChange={setEnd} error={errors.fields.endDate} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="msg">Mensagem ao dono (opcional)</Label>
        <textarea
          id="msg"
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Para que vais usar e onde preferes levantar o equipamento."
          className="rounded-bz-sm border border-borda-forte bg-branco p-3 text-[15px] text-texto-corpo outline-none placeholder:text-cinza focus-visible:border-verde focus-visible:ring-[3px] focus-visible:ring-verde-medio/20"
        />
      </div>

      <div className="grid gap-3 rounded-bz-md border border-borda bg-branco p-4">
        <p className="font-medium text-verde">{days > 0 ? formatRange(start, end) : "Escolhe as datas"}</p>
        {days > 0 && <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={Number(item.depositAmount ?? 0)} />}
      </div>

      <div className="flex gap-3 rounded-bz-md bg-ambar-tint p-3 text-sm text-aviso-texto">
        <Clock className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
        <p>O dono tem 24 h para responder. Só pagas depois de ele aceitar.</p>
      </div>

      <label className="flex min-h-11 items-start gap-3 text-[15px]">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-5 accent-verde" />
        <span>
          Aceito as condições de aluguer: devolvo o equipamento nas datas combinadas e no mesmo estado, e a caução pode ser retida se houver dano.
          {errors.fields.terms && <span className="block text-[13px] text-erro">{errors.fields.terms}</span>}
        </span>
      </label>

      <FormError message={errors.form} />
      <StickyCTABar>
        <Button type="submit" className="w-full" disabled={sending || isOwnItem}>
          {sending ? "A enviar pedido…" : "Enviar pedido"}
        </Button>
      </StickyCTABar>
    </form>
  );
}
