"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronRight, Clock, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { categoryIcon } from "@/components/bz/brand";
import { PriceSummary } from "@/components/bz/booking";
import { Avatar, ConditionMeter, ItemPhoto, placeOf } from "@/components/bz/equipment";
import { TextField } from "@/components/bz/form";
import { Sheet } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Badge, ButtonLink, Card, Eyebrow, Kz, Skeleton, buttonClass } from "@/components/bz/ui";
import { catalogApi } from "@/lib/api";
import { whatsappLink } from "@/lib/booking";
import { addDaysIso, daysBetween, formatRange, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { Item } from "@/lib/types";

export default function EquipamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, error, reload } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));
  const [photo, setPhoto] = useState(0);
  const [start, setStart] = useState(todayIso(1));
  const [end, setEnd] = useState(todayIso(3));
  const [depositInfo, setDepositInfo] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!item) {
    return (
      <div role="status" aria-label="A carregar" className="grid gap-4 md:grid-cols-2 md:gap-10">
        <Skeleton className="aspect-[4/3] rounded-cartao" />
        <div className="grid content-start gap-3">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 rounded-cartao" />
        </div>
      </div>
    );
  }

  const photos = [...item.photos].sort((a, b) => a.position - b.position);
  const available = item.status === "ACTIVE";
  const days = daysBetween(start, end);
  const deposit = Number(item.depositAmount ?? 0);
  const Icon = categoryIcon(item.category?.slug);
  const reserveHref = `/equipamento/${id}/reservar?de=${start}&ate=${end}`;
  const waText = `Olá Beeznoo! Tenho uma pergunta sobre "${item.title}" (${formatRange(start, end)}).`;

  return (
    <div className="grid gap-6">
      <div className="hidden md:block">
        <BackLink href="/explorar">Explorar</BackLink>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        {/* Galeria: deslizar no telemóvel */}
        <div className="-mx-4 -mt-5 grid gap-3 md:mx-0 md:mt-0">
          <div className="relative">
            <div
              className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:rounded-sheet"
              onScroll={(e) => setPhoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            >
              {(photos.length ? photos : [null]).map((p, i) => (
                <ItemPhoto key={p?.id ?? i} src={p?.photUrl} alt={`${item.title} — foto ${i + 1}`} icon={Icon} rounded={false} className="w-full shrink-0 snap-center" />
              ))}
            </div>
            {photos.length > 1 && (
              <span className="num absolute right-4 bottom-4 rounded-full bg-verde/80 px-3 py-1 text-[13px] font-bold text-areia backdrop-blur">
                {photo + 1} / {photos.length}
              </span>
            )}
          </div>
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.category && <Badge tone="analise" icon={Icon}>{item.category.name}</Badge>}
              {!available && <Badge tone="neutro">Indisponível</Badge>}
            </div>
            <h1 className="font-titulo text-[30px] leading-[1.05] font-extrabold tracking-tight text-verde md:text-[40px]">{item.title}</h1>
            <p className="flex items-center gap-1.5 text-cinza">
              <MapPin className="size-4 text-mel" strokeWidth={1.8} aria-hidden /> {placeOf(item)}
            </p>
            <div className="flex items-baseline gap-1 text-verde">
              <Kz value={item.pricePerDay} className="text-4xl" />
              <span className="text-cinza">/dia</span>
            </div>
            <ConditionMeter condition={item.condition} />
          </div>

          {/* Dono */}
          <Card className="flex items-center gap-3 p-4">
            <Avatar name={item.ownerName} size="lg" />
            <div className="min-w-0 flex-1">
              <Eyebrow>Dono</Eyebrow>
              <p className="truncate font-titulo text-lg font-bold text-verde">{item.ownerName}</p>
              <p className="flex items-center gap-1 text-[13px] text-cinza">
                <Clock className="size-3.5" strokeWidth={1.8} aria-hidden /> Responde em até 24 h
              </p>
            </div>
          </Card>

          {/* Datas + preço */}
          <Card className="grid gap-4 p-4">
            <p className="flex items-center gap-2 font-bold text-verde">
              <CalendarDays className="size-5 text-mel" strokeWidth={1.8} aria-hidden /> Quando precisas?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Levantas" type="date" min={todayIso()} value={start} onChange={(v) => { setStart(v); if (v >= end) setEnd(addDaysIso(v, 1)); }} />
              <TextField label="Devolves" type="date" min={start} value={end} onChange={setEnd} />
            </div>
            {days > 0 ? (
              <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={deposit} />
            ) : (
              <p className="text-sm text-erro">A devolução tem de ser pelo menos um dia depois.</p>
            )}
            <p className="text-[13px] text-cinza">O dono confirma a disponibilidade quando aceitar o pedido.</p>
          </Card>

          <button
            type="button"
            onClick={() => setDepositInfo(true)}
            className="flex items-center gap-3 rounded-cartao bg-salvia-tint p-4 text-left text-verde transition hover:brightness-[.98]"
          >
            <ShieldCheck className="size-6 shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
            <span className="flex-1">
              <span className="block font-bold">Proteção Beeznoo</span>
              <span className="text-sm">Contrato, caução e fotos na entrega. Como funciona?</span>
            </span>
            <ChevronRight className="size-5" strokeWidth={1.8} aria-hidden />
          </button>

          {item.description && (
            <section className="grid gap-2">
              <h2 className="font-titulo text-lg font-bold text-verde">Sobre o equipamento</h2>
              <p className="whitespace-pre-line text-texto-corpo">{item.description}</p>
            </section>
          )}

          <StickyCTA
            aside={
              <p className="leading-tight text-verde">
                <Kz value={item.pricePerDay} className="text-xl" />
                <span className="text-[13px] text-cinza"> /dia</span>
              </p>
            }
          >
            <div className="flex gap-2">
              <a href={whatsappLink(waText)} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" className={cn(buttonClass("outline"), "px-3.5 md:px-5")}>
                <MessageCircle strokeWidth={1.8} />
                <span className="hidden md:inline">WhatsApp</span>
              </a>
              <ButtonLink href={reserveHref} className={cn("md:flex-1", !available || days < 1 ? "pointer-events-none opacity-50" : "")} aria-disabled={!available || days < 1}>
                Pedir reserva
              </ButtonLink>
            </div>
          </StickyCTA>
        </div>
      </div>

      <Sheet open={depositInfo} onClose={() => setDepositInfo(false)} title="Como funciona a caução">
        <DepositExplainer pricePerDay={Number(item.pricePerDay)} deposit={deposit} />
      </Sheet>
    </div>
  );
}

function DepositExplainer({ pricePerDay, deposit }: { pricePerDay: number; deposit: number }) {
  const steps = [
    { t: "Pagas o aluguer + a caução", d: `Neste equipamento a caução é ${deposit.toLocaleString("de-DE")} Kz. Fica retida pela Beeznoo, não vai para o dono.` },
    { t: "Fotografam juntos na entrega", d: "A checklist com fotos regista o estado. Protege-te a ti e ao dono." },
    { t: "Devolves e a equipa confirma", d: "Se estiver tudo em ordem, a caução volta para ti." },
    { t: "Se houver dano", d: "Reportas o problema e a equipa decide, com base nas fotos, se retém parte ou toda a caução." },
  ];
  return (
    <div className="grid gap-5 pt-2">
      <ol className="grid gap-4">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-verde font-titulo font-bold text-ambar">{i + 1}</span>
            <div>
              <p className="font-bold text-verde">{s.t}</p>
              <p className="text-sm text-cinza">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-cartao bg-areia-2 p-4 text-sm text-verde">
        Exemplo: 3 dias a {pricePerDay.toLocaleString("de-DE")} Kz → pagas {(pricePerDay * 3 * 1.08 + deposit).toLocaleString("de-DE", { maximumFractionDigits: 0 })} Kz e
        recebes de volta {deposit.toLocaleString("de-DE")} Kz depois da devolução.
      </div>
    </div>
  );
}
