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
import { isKycRequired, KYC_REDIRECT_TOAST } from "@/lib/kyc";

const STEPS = ["Datas", "Entrega", "Mensagem", "Rever"];
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

  if (!session) return null;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;
  if (!item) return <Skeleton role="status" aria-label="A carregar" className="h-96 rounded-cartao" />;

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
      if (start < todayIso()) fields.startDate = "Não pode ser no passado.";
      if (days < 1) fields.endDate = "Pelo menos um dia depois.";
      else if (conflict) fields.startDate = `Já está ocupado a ${formatDay(conflict)}. Escolhe outras datas.`;
    }
    if (s === 2 && handover === "delivery" && !area) fields.area = "Escolhe o bairro de entrega.";
    if (s === 4 && !terms) fields.terms = "Tens de aceitar as condições para continuar.";
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
        handover === "pickup" ? `Entrega: levanto no local do dono, às ${time}.` : `Entrega: peço entrega em ${area}, às ${time}.`;
      const booking = await bookingApi.create({
        itemId: id,
        startDate: start,
        endDate: end,
        renterMessage: [handoverLine, message.trim()].filter(Boolean).join("\n\n"),
      });
      router.replace(`/reservas/${booking.id}?novo=1`);
    } catch (err) {
      if (isKycRequired(err)) {
        toast(KYC_REDIRECT_TOAST);
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
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> Passo anterior
        </button>
      ) : (
        <BackLink href={`/equipamento/${id}`}>Voltar ao equipamento</BackLink>
      )}

      <Card className="flex items-center gap-3 p-2.5">
        <ItemPhoto src={item.photos[0]?.photUrl} alt={item.title} className="w-20 shrink-0 rounded-campo" />
        <div className="min-w-0">
          <p className="truncate font-titulo text-[17px] font-bold tracking-tight text-verde">{item.title}</p>
          <p className="text-sm text-cinza">
            <Kz value={item.pricePerDay} className="text-sm" /> /dia · {item.ownerName}
          </p>
        </div>
      </Card>

      {needsKyc ? (
        <div className="grid gap-4">
          <Callout tone="warn" title="Antes de pedir, verifica a tua identidade">
            É feito à mão pela equipa e pode demorar até 2 dias úteis. Só precisas de o fazer uma vez. Depois voltas a este equipamento e pedes.
          </Callout>
          <ButtonLink href="/verificacao" size="lg">Verificar identidade</ButtonLink>
        </div>
      ) : blocked ? (
        <Callout tone="warn" title={isOwnItem ? "Este equipamento é teu" : "A tua conta é só de dono"}>
          {isOwnItem ? "Não podes reservar o teu próprio equipamento." : "Para alugar, a conta tem de ser de arrendatário ou de \"as duas coisas\". Fala connosco para mudar."}
        </Callout>
      ) : (
        <>
          <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />

          {step === 1 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">Para que dias?</h1>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Levantas" type="date" min={todayIso()} value={start} onChange={(v) => { setStart(v); if (v >= end) setEnd(addDaysIso(v, 1)); }} error={errors.fields.startDate} />
                <TextField label="Devolves" type="date" min={addDaysIso(start, 1)} value={end} onChange={setEnd} error={errors.fields.endDate} />
              </div>
              {availability.data && (
                <Card className="p-4">
                  <MonthCalendar days={busyDays} mode="public" selection={days > 0 ? { start, end } : undefined} initialMonth={start} />
                </Card>
              )}
              {conflict ? (
                <Callout tone="warn">Já está ocupado a {formatDay(conflict)}. O dia de devolução pode coincidir com o início de outro aluguer, mas nenhum dia de uso pode.</Callout>
              ) : days > 0 && (
                <p className="flex items-center gap-2.5 rounded-cartao bg-areia-2 p-4 text-verde">
                  <CalendarDays className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                  <span><strong className="font-titulo">{formatRange(start, end)}</strong> · <span className="num">{days} {days === 1 ? "dia" : "dias"}</span></span>
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">Como recebes o equipamento?</h1>
              <RadioCards<Handover>
                legend="Entrega e recolha"
                name="handover"
                value={handover}
                onChange={setHandover}
                options={[
                  { value: "pickup", title: "Levanto no dono", text: "Combinam o sítio exato depois de ele aceitar.", icon: Home },
                  { value: "delivery", title: "Peço entrega", text: "O dono diz se consegue e quanto custa (combinado à parte).", icon: Truck },
                ]}
              />
              {handover === "delivery" && (
                <SelectField label="Bairro de entrega" value={area} onChange={setArea} placeholder="Escolhe o bairro" options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))} error={errors.fields.area} />
              )}
              <TextField label="Hora preferida" type="time" value={time} onChange={setTime} />
              <Callout tone="info" icon={MapPin}>Quem faz a entrega e se tem custo ainda está por fechar. Por agora combina-se com o dono.</Callout>
            </section>
          )}

          {step === 3 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">Diz ao dono para que é</h1>
              <TextArea
                label="Mensagem (opcional)"
                value={message}
                onChange={setMessage}
                maxLength={800}
                placeholder="Ex.: casamento em Talatona no sábado. Já trabalhei com a A7 III."
                hint="Pedidos com contexto são aceites mais depressa."
              />
            </section>
          )}

          {step === 4 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-verde md:text-[32px]">Rever e enviar</h1>
              <Card className="grid gap-4 p-4">
                <p className="flex items-start gap-2.5 font-bold text-verde">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                  <span>
                    {formatRange(start, end)} · {handover === "pickup" ? "levantas no dono" : `entrega em ${area}`} às {time}
                  </span>
                </p>
                <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={Number(item.depositAmount ?? 0)} />
              </Card>
              <Callout tone="warn" icon={Clock}>O dono tem 24 h para responder. Pagas na entrega, ao dono, depois de conferires o equipamento.</Callout>
              <Checkbox checked={terms} onChange={setTerms} error={errors.fields.terms}>
                Aceito as condições: devolvo nas datas combinadas e no mesmo estado, e a caução pode ser retida se houver dano.
              </Checkbox>
              <FormError message={errors.form} />
            </section>
          )}

          <StickyCTA>
            {step < STEPS.length ? (
              <Button block size="lg" arrow onClick={next}>
                Continuar
              </Button>
            ) : (
              <Button block size="lg" loading={sending} onClick={submit}>
                {sending ? "A enviar pedido…" : "Enviar pedido"}
              </Button>
            )}
          </StickyCTA>
        </>
      )}
      {blocked && (
        <ButtonLink href="/explorar" variant="outline">
          Voltar a explorar
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
