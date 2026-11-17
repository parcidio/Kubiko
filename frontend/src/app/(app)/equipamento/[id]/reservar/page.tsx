"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Home, MapPin, Truck } from "lucide-react";
import { PriceSummary } from "@/components/bz/booking";
import { MonthCalendar } from "@/components/bz/calendar";
import { ItemPhoto } from "@/components/bz/equipment";
import { Checkbox, FormError, RadioCards, SelectField, StepProgress, TextArea, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Callout, Card, Kz, Skeleton } from "@/components/bz/ui";
import { bookingApi, catalogApi, profileApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { firstConflict, unavailableDays } from "@/lib/availability";
import { addDaysIso, daysBetween, formatDay, formatRange, LUANDA_AREAS, todayIso } from "@/lib/format";
import { canRent } from "@/lib/mode";
import type { Availability, Item, Me } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { isKycRequired, kycRedirectToast } from "@/lib/kyc";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

type Handover = "pickup" | "delivery";

function Reservar() {
  const session = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const { data: item, error: loadError, reload } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));

  // Datas já escolhidas no Detalhe: começa no passo 2 (o 1 continua a um toque, em "Passo anterior")
  const given = validIso(params.get("de")) && validIso(params.get("ate")) && params.get("de")! >= todayIso() && params.get("ate")! > params.get("de")!;
  const [step, setStep] = useState(given ? 2 : 1);
  const [start, setStart] = useState(given ? params.get("de")! : todayIso(1));
  const [end, setEnd] = useState(given ? params.get("ate")! : todayIso(3));
  const [handover, setHandover] = useState<Handover>("pickup");
  const [area, setArea] = useState("");
  const [time, setTime] = useState("10:00");
  const [message, setMessage] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [sending, setSending] = useState(false);
  const availability = useResource<Availability>(`availability:${id}`, () => catalogApi.availability(id));
  const me = useResource<Me>(session ? "profile:me" : null, () => profileApi.me());
  const lang = useLang();
  const dict = useT();
  const t = dict.reserve;
  const STEPS = t.steps;

  if (!session) return null;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;
  if (!item) return <Skeleton role="status" aria-label={dict.common.loading} className="h-96 rounded-cartao" />;

  const days = daysBetween(start, end);
  const busyDays = unavailableDays(availability.data);
  const conflict = firstConflict(busyDays, start, end);
  const isOwnItem = item.ownerId === session.profileId;
  const blocked = isOwnItem || !canRent(session.role);
  // KYC por aprovar: avisar já, em vez de deixar preencher os 4 passos e falhar no envio
  const needsKyc = !blocked && me.data?.canTransact === false;

  function validate(s: number) {
    const fields: Record<string, string> = {};
    if (s === 1) {
      if (start < todayIso()) fields.startDate = t.pastDate;
      if (days < 1) fields.endDate = t.minOneDay;
      else if (conflict) fields.startDate = fmt(t.busyOn, { day: formatDay(conflict, false, lang) });
    }
    if (s === 2 && handover === "delivery" && !area) fields.area = t.pickArea;
    if (s === 4 && !terms) fields.terms = t.acceptTerms;
    setErrors({ fields });
    return Object.keys(fields).length === 0;
  }

  async function submit() {
    // as datas podem ter vindo do Detalhe sem passar pelo passo 1: validam-se aqui também
    if (!validate(1)) {
      setStep(1);
      return;
    }
    if (!validate(4)) return;
    setSending(true);
    try {
      // A API ainda não tem campos de entrega (BACKEND_GAPS): seguem na mensagem ao dono.
      const handoverLine =
        handover === "pickup" ? fmt(t.handoverPickup, { time }) : fmt(t.handoverDelivery, { area, time });
      const booking = await bookingApi.create({
        itemId: id,
        startDate: start,
        endDate: end,
        renterMessage: [handoverLine, message.trim()].filter(Boolean).join("\n\n"),
      });
      router.replace(`/reservas/${booking.id}?novo=1`);
    } catch (err) {
      if (isKycRequired(err)) {
        toast(kycRedirectToast());
        router.push("/verificacao");
        return;
      }
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  }

  const next = () => validate(step) && setStep(step + 1);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {step > 1 ? (
        <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline">
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> {t.prevStep}
        </button>
      ) : (
        <BackLink href={`/equipamento/${id}`}>{t.backToItem}</BackLink>
      )}

      <Card className="flex items-center gap-3 p-2.5">
        <ItemPhoto src={item.photos[0]?.photUrl} alt={item.title} className="w-20 shrink-0 rounded-campo" />
        <div className="min-w-0">
          <p className="truncate font-titulo text-[17px] font-bold tracking-tight text-verde">{item.title}</p>
          <p className="text-sm text-cinza">
            <Kz value={item.pricePerDay} className="text-sm" /> {dict.common.perDay} · {item.ownerName}
          </p>
        </div>
      </Card>

      {needsKyc ? (
        <div className="grid gap-4">
          <Callout tone="warn" title={t.kycTitle}>
            {t.kycText}
          </Callout>
          <ButtonLink href="/verificacao" size="lg">{t.verify}</ButtonLink>
        </div>
      ) : blocked ? (
        <Callout tone="warn" title={isOwnItem ? t.ownItemTitle : t.ownerOnlyTitle}>
          {isOwnItem ? t.ownItemText : t.ownerOnlyText}
        </Callout>
      ) : (
        <>
          <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />

          {step === 1 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">{t.whichDays}</h1>
              <div className="grid grid-cols-2 gap-3">
                <TextField label={t.pickup} type="date" min={todayIso()} value={start} onChange={(v) => { setStart(v); if (v >= end) setEnd(addDaysIso(v, 1)); }} error={errors.fields.startDate} />
                <TextField label={t.dropoff} type="date" min={addDaysIso(start, 1)} value={end} onChange={setEnd} error={errors.fields.endDate} />
              </div>
              {availability.data && (
                <Card className="p-4">
                  <MonthCalendar days={busyDays} mode="public" selection={days > 0 ? { start, end } : undefined} initialMonth={start} />
                </Card>
              )}
              {conflict ? (
                <Callout tone="warn">{fmt(t.busyCallout, { day: formatDay(conflict, false, lang) })}</Callout>
              ) : days > 0 && (
                <p className="flex items-center gap-2.5 rounded-cartao bg-areia-2 p-4 text-verde">
                  <CalendarDays className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                  <span><strong className="font-titulo">{formatRange(start, end, lang)}</strong> · <span className="num">{plural(days, dict.common.days)}</span></span>
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">{t.howReceive}</h1>
              <RadioCards<Handover>
                legend={t.handoverLegend}
                name="handover"
                value={handover}
                onChange={setHandover}
                options={[
                  { value: "pickup", title: t.pickupTitle, text: t.pickupText, icon: Home },
                  { value: "delivery", title: t.deliveryTitle, text: t.deliveryText, icon: Truck },
                ]}
              />
              {handover === "delivery" && (
                <SelectField label={t.deliveryArea} value={area} onChange={setArea} placeholder={t.pickAreaPh} options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))} error={errors.fields.area} />
              )}
              <TextField label={t.time} type="time" value={time} onChange={setTime} />
              <Callout tone="info" icon={MapPin}>{t.deliveryNote}</Callout>
            </section>
          )}

          {step === 3 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">{t.tellOwner}</h1>
              <TextArea
                label={t.message}
                value={message}
                onChange={setMessage}
                maxLength={800}
                placeholder={t.messagePh}
                hint={t.messageHint}
              />
            </section>
          )}

          {step === 4 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">{t.review}</h1>
              <Card className="grid gap-4 p-4">
                <p className="flex items-start gap-2.5 font-bold text-verde">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                  <span>
                    {fmt(handover === "pickup" ? t.summaryPickup : t.summaryDelivery, { range: formatRange(start, end, lang), area, time })}
                  </span>
                </p>
                <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={Number(item.depositAmount ?? 0)} />
              </Card>
              <Callout tone="warn" icon={Clock}>{t.ownerHas24h}</Callout>
              <Checkbox checked={terms} onChange={setTerms} error={errors.fields.terms}>
                {t.terms}
              </Checkbox>
              <FormError message={errors.form} />
            </section>
          )}

          <StickyCTA>
            {step < STEPS.length ? (
              <Button block size="lg" arrow onClick={next}>
                {dict.common.continue}
              </Button>
            ) : (
              <Button block size="lg" loading={sending} onClick={submit}>
                {sending ? t.sending : t.send}
              </Button>
            )}
          </StickyCTA>
        </>
      )}
      {blocked && (
        <ButtonLink href="/explorar" variant="outline">
          {t.backToExplore}
        </ButtonLink>
      )}
    </div>
  );
}

export default function ReservarPage() {
  return (
    <Suspense>
      <Reservar />
    </Suspense>
  );
}

// "2026-11-16" ou null (parâmetros do URL não são de confiança)
function validIso(v: string | null) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
