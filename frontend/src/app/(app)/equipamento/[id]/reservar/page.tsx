"use client";

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock, Home, MapPin, Truck } from "lucide-react";
import { PriceSummary } from "@/components/bz/booking";
import { ItemPhoto } from "@/components/bz/equipment";
import { Checkbox, FormError, RadioCards, SelectField, StepProgress, TextArea, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Button, ButtonLink, Callout, Card, Kz, Skeleton } from "@/components/bz/ui";
import { bookingApi, catalogApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { addDaysIso, daysBetween, formatRange, LUANDA_AREAS, todayIso } from "@/lib/format";
import { canRent } from "@/lib/mode";
import type { Item } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const STEPS = ["Datas", "Entrega", "Mensagem", "Rever"];
type Handover = "pickup" | "delivery";

function Reservar() {
  const session = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const { data: item, error: loadError, reload } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));

  const [step, setStep] = useState(1);
  const [start, setStart] = useState(params.get("de") ?? todayIso(1));
  const [end, setEnd] = useState(params.get("ate") ?? todayIso(3));
  const [handover, setHandover] = useState<Handover>("pickup");
  const [area, setArea] = useState("");
  const [time, setTime] = useState("10:00");
  const [message, setMessage] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [sending, setSending] = useState(false);

  if (!session) return null;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;
  if (!item) return <Skeleton role="status" aria-label="A carregar" className="h-96 rounded-cartao" />;

  const days = daysBetween(start, end);
  const isOwnItem = item.ownerId === session.profileId;
  const blocked = isOwnItem || !canRent(session.role);

  function validate(s: number) {
    const fields: Record<string, string> = {};
    if (s === 1) {
      if (start < todayIso()) fields.startDate = "Não pode ser no passado.";
      if (days < 1) fields.endDate = "Pelo menos um dia depois.";
    }
    if (s === 2 && handover === "delivery" && !area) fields.area = "Escolhe o bairro de entrega.";
    if (s === 4 && !terms) fields.terms = "Tens de aceitar as condições para continuar.";
    setErrors({ fields });
    return Object.keys(fields).length === 0;
  }

  async function submit() {
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
      setErrors(toFormErrors(err));
    } finally {
      setSending(false);
    }
  }

  const next = () => validate(step) && setStep(step + 1);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {step > 1 ? (
        <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline">
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> Passo anterior
        </button>
      ) : (
        <BackLink href={`/equipamento/${id}`}>Voltar ao equipamento</BackLink>
      )}

      <Card className="flex items-center gap-3 p-3">
        <ItemPhoto src={item.photos[0]?.photUrl} alt={item.title} className="w-20 shrink-0 rounded-campo" />
        <div className="min-w-0">
          <p className="truncate font-titulo font-bold text-verde">{item.title}</p>
          <p className="text-sm text-cinza">
            <Kz value={item.pricePerDay} className="text-sm" /> /dia · {item.ownerName}
          </p>
        </div>
      </Card>

      {blocked ? (
        <Callout tone="warn" title={isOwnItem ? "Este equipamento é teu" : "A tua conta é só de dono"}>
          {isOwnItem ? "Não podes reservar o teu próprio equipamento." : "Para alugar, a conta tem de ser de arrendatário ou de \"as duas coisas\". Fala connosco para mudar."}
        </Callout>
      ) : (
        <>
          <StepProgress step={step} total={STEPS.length} label={STEPS[step - 1]} />

          {step === 1 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[28px] leading-tight font-bold text-verde">Para que dias?</h1>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Levantas" type="date" min={todayIso()} value={start} onChange={(v) => { setStart(v); if (v >= end) setEnd(addDaysIso(v, 1)); }} error={errors.fields.startDate} />
                <TextField label="Devolves" type="date" min={addDaysIso(start, 1)} value={end} onChange={setEnd} error={errors.fields.endDate} />
              </div>
              {days > 0 && (
                <p className="rounded-cartao bg-areia-2 p-4 text-verde">
                  <strong>{formatRange(start, end)}</strong> · {days} {days === 1 ? "dia" : "dias"}
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="grid animate-sobe gap-4">
              <h1 className="font-titulo text-[28px] leading-tight font-bold text-verde">Como recebes o equipamento?</h1>
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
              <h1 className="font-titulo text-[28px] leading-tight font-bold text-verde">Diz ao dono para que é</h1>
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
              <h1 className="font-titulo text-[28px] leading-tight font-bold text-verde">Rever e enviar</h1>
              <Card className="grid gap-4 p-4">
                <p className="font-bold text-verde">
                  {formatRange(start, end)} · {handover === "pickup" ? "levantas no dono" : `entrega em ${area}`} às {time}
                </p>
                <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={Number(item.depositAmount ?? 0)} />
              </Card>
              <Callout tone="warn" icon={Clock}>O dono tem 24 h para responder. Só pagas depois de ele aceitar.</Callout>
              <Checkbox checked={terms} onChange={setTerms} error={errors.fields.terms}>
                Aceito as condições: devolvo nas datas combinadas e no mesmo estado, e a caução pode ser retida se houver dano.
              </Checkbox>
              <FormError message={errors.form} />
            </section>
          )}

          <StickyCTA>
            {step < STEPS.length ? (
              <Button block size="lg" variant="dark" onClick={next}>
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
