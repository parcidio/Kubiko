"use client";

import { useServiceFeeRate } from "@/lib/fee";
import { useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LayoutGrid, MapPin, MessageCircle, Repeat2, ShieldCheck, Sparkles } from "lucide-react";
import { categoryIcon } from "@/components/bz/brand";
import { PriceSummary } from "@/components/bz/booking";
import { MonthCalendar } from "@/components/bz/calendar";
import { Rail, ReviewsSection } from "@/components/bz/discover";
import { Avatar, ConditionMeter, ItemPhoto, Stars, VerifiedBadge, formatRating, placeOf } from "@/components/bz/equipment";
import { TextField } from "@/components/bz/form";
import { HexTile } from "@/components/bz/hex";
import { Sheet, toast } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Badge, Button, ButtonLink, Callout, Card, Eyebrow, Kz, Skeleton, buttonClass } from "@/components/bz/ui";
import { adminApi, catalogApi, profileApi } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { whatsappLink } from "@/lib/booking";
import { firstConflict, unavailableDays } from "@/lib/availability";
import { addDaysIso, daysBetween, formatDay, formatRange, todayIso } from "@/lib/format";
import { canRent } from "@/lib/mode";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { Availability, Item, Me } from "@/lib/types";

export default function EquipamentoPage() {
  const feeRate = useServiceFeeRate(); // PAYMENTS_SERVICE_FEE_RATE, via API
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const { data: item, error, reload, setData } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));
  const [featuring, setFeaturing] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState(0);
  // Datas escolhidas no Explorar (?de=&ate=) vêm já preenchidas; senão, amanhã a daqui a 3 dias
  const params = useSearchParams();
  const fromIso = validIso(params.get("de"));
  const toIso = validIso(params.get("ate"));
  const givenDates = fromIso && toIso && fromIso >= todayIso() && toIso > fromIso;
  const [start, setStart] = useState(givenDates ? fromIso : todayIso(1));
  const [end, setEnd] = useState(givenDates ? toIso : todayIso(3));
  // Quem ainda não pode pedir (KYC por aprovar) é avisado aqui, não depois de preencher o pedido
  const me = useResource<Me>(session ? "profile:me" : null, () => profileApi.me());
  const [depositInfo, setDepositInfo] = useState(false);
  // Dias ocupados (público). Se falhar, o pedido continua possível: a API valida na mesma
  const availability = useResource<Availability>(`availability:${id}`, () => catalogApi.availability(id));

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
  const busyDays = unavailableDays(availability.data);
  const conflict = firstConflict(busyDays, start, end);
  const reserveHref = `/equipamento/${id}/reservar?de=${start}&ate=${end}`;
  const isOwn = session?.profileId === item.ownerId;
  const needsKyc = !!session && canRent(session.role) && !isOwn && me.data?.canTransact === false;
  const rentalTotal = days > 0 ? Math.round(Number(item.pricePerDay) * days * (1 + feeRate)) : 0;
  // O botão diz porque não dá para pedir, em vez de ficar só cinzento
  const ctaBlocked = !available ? "Indisponível" : conflict ? "Escolhe outras datas" : days < 1 ? "Escolhe as datas" : null;
  const waText = `Olá Beeznoo! Tenho uma pergunta sobre "${item.title}" (${formatRange(start, end)}).`;

  async function toggleFeatured() {
    setFeaturing(true);
    try {
      const updated = await adminApi.setFeatured(id, !item!.featured);
      setData(updated);
      toast.success(updated.featured ? "Está em destaque no Explorar." : "Destaque retirado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar o destaque.");
    } finally {
      setFeaturing(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-8">
      <div className="hidden md:block">
        <BackLink href="/explorar">Explorar</BackLink>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        {/* Galeria: deslizar no telemóvel */}
        <div className="-mx-4 -mt-5 grid content-start gap-3 md:sticky md:top-24 md:mx-0 md:mt-0 md:self-start">
          <div className="relative">
            <div
              ref={gallery}
              className="flex snap-x snap-mandatory overflow-x-auto bg-areia-2 [scrollbar-width:none] md:rounded-sheet"
              onScroll={(e) => setPhoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            >
              {(photos.length ? photos : [null]).map((p, i) => (
                <ItemPhoto key={p?.id ?? i} src={p?.photUrl} alt={`${item.title} — foto ${i + 1}`} icon={Icon} rounded={false} className="w-full shrink-0 snap-center" />
              ))}
            </div>
            {/* Voltar a flutuar sobre a foto (no desktop há o BackLink por cima) */}
            <Link
              href="/explorar"
              aria-label="Voltar a explorar"
              className="absolute top-4 left-4 flex size-11 items-center justify-center rounded-campo bg-branco/90 text-verde shadow-float backdrop-blur transition-transform duration-200 active:scale-95 md:hidden"
            >
              <ChevronLeft className="size-5" strokeWidth={1.8} aria-hidden />
            </Link>
            {photos.length > 1 && (
              <>
                <span className="num absolute right-4 bottom-4 rounded-full bg-verde/75 px-3 py-1 text-[13px] font-bold text-areia backdrop-blur">
                  {photo + 1} / {photos.length}
                </span>
                <span aria-hidden className="absolute inset-x-0 bottom-5 flex justify-center gap-1.5">
                  {photos.map((p, i) => (
                    <span key={p.id} className={cn("h-1.5 w-5 origin-center rounded-full bg-branco transition-[transform,opacity] duration-350 ease-out", i === photo ? "scale-x-100" : "scale-x-[.3] opacity-60")} />
                  ))}
                </span>
              </>
            )}
            {item.featured && (
              <span className="absolute top-4 right-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-verde px-3 text-[13px] font-bold text-areia md:right-auto md:left-4 [&_svg]:text-ambar">
                <Sparkles className="size-4" strokeWidth={1.8} aria-hidden /> Em destaque
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="hidden gap-2 md:flex">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === photo}
                  onClick={() => gallery.current?.scrollTo({ left: i * gallery.current.clientWidth, behavior: "smooth" })}
                  className={cn("w-20 cursor-pointer overflow-hidden rounded-campo border-2 transition-[border-color,opacity] duration-200", i === photo ? "border-verde" : "border-transparent opacity-70 hover:opacity-100")}
                >
                  <ItemPhoto src={p.photUrl} alt="" icon={Icon} rounded={false} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sem animação neste wrapper: um transform num antepassado prende o position:fixed do StickyCTA */}
        <div className="grid content-start gap-5">
          <div className="grid animate-sobe gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.category && <Badge tone="analise" icon={Icon}>{item.category.name}</Badge>}
              {!available && <Badge tone="neutro">Indisponível</Badge>}
            </div>
            <h1 className="font-titulo text-[28px] leading-[1.05] font-bold tracking-[-0.02em] text-verde md:text-[40px]">{item.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-cinza">
              {item.ratingAverage && item.ratingCount > 0 ? (
                <a href="#avaliacoes" className="inline-flex min-h-11 items-center gap-1.5 hover:underline md:min-h-0">
                  <Stars value={item.ratingAverage} size="sm" />
                  <span className="num font-bold text-verde">{formatRating(item.ratingAverage)}</span>
                  <span className="num">· {item.ratingCount} {item.ratingCount === 1 ? "avaliação" : "avaliações"}</span>
                </a>
              ) : (
                <span className="font-medium text-mel-texto">Novo na Beeznoo</span>
              )}
              {item.completedRentals > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Repeat2 className="size-4 text-mel" strokeWidth={1.8} aria-hidden />
                  <span className="num">Alugado {item.completedRentals} {item.completedRentals === 1 ? "vez" : "vezes"}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4 text-mel" strokeWidth={1.8} aria-hidden /> {placeOf(item)}
              </span>
            </div>
            <div className="flex items-baseline gap-1 text-verde">
              <Kz value={item.pricePerDay} className="text-[32px] md:text-4xl" />
              <span className="text-cinza">por dia</span>
            </div>
            <ConditionMeter condition={item.condition} />
          </div>

          {/* Dono */}
          <Card className="flex items-center gap-3 p-4">
            <Avatar name={item.ownerName} size="lg" />
            <div className="min-w-0 flex-1">
              <Eyebrow>Dono</Eyebrow>
              <p className="flex min-w-0 items-center gap-2">
                <span className="truncate font-titulo text-lg font-bold text-verde">{item.ownerName}</span>
                {item.ownerVerified && <VerifiedBadge compact />}
              </p>
              <p className="flex items-center gap-1 text-[13px] text-cinza">
                <Clock className="size-3.5" strokeWidth={1.8} aria-hidden /> Tem 24 h para responder ao teu pedido
              </p>
            </div>
          </Card>

          {/* Datas + preço */}
          <Card className="grid gap-4 p-4">
            <h2 className="flex items-center gap-3 font-titulo text-lg font-bold tracking-tight text-verde">
              <HexTile icon={CalendarDays} tone="ambar-tint" size={40} /> Quando precisas?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Levantas" type="date" min={todayIso()} value={start} onChange={(v) => { setStart(v); if (v >= end) setEnd(addDaysIso(v, 1)); }} />
              <TextField label="Devolves" type="date" min={start} value={end} onChange={setEnd} />
            </div>
            {availability.data && (
              <MonthCalendar
                days={busyDays}
                mode="public"
                selection={days > 0 ? { start, end } : undefined}
                initialMonth={start}
                onDayClick={(d) => {
                  // 1.º toque: levantas; 2.º toque depois disso: devolves
                  if (d > start && days === 1 && end === addDaysIso(start, 1) && !firstConflict(busyDays, start, d)) setEnd(d);
                  else { setStart(d); setEnd(addDaysIso(d, 1)); }
                }}
              />
            )}
            {conflict ? (
              <p role="alert" className="text-sm text-erro">
                Já está ocupado a {formatDay(conflict)}. Escolhe outras datas.
              </p>
            ) : days > 0 ? (
              <>
                <PriceSummary pricePerDay={Number(item.pricePerDay)} days={days} deposit={deposit} />
                <p className="flex gap-2.5 rounded-cartao bg-salvia-tint p-3 text-sm text-verde">
                  <ShieldCheck className="mt-0.5 size-[18px] shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
                  Não pagas nada agora. Conferes o equipamento na entrega e só depois pagas ao dono.
                </p>
              </>
            ) : (
              <p className="text-sm text-erro">A devolução tem de ser pelo menos um dia depois.</p>
            )}
            <p className="text-[13px] text-cinza">O dia de devolução fica livre para o aluguer seguinte. O dono confirma quando aceitar o pedido.</p>
          </Card>

          <button
            type="button"
            onClick={() => setDepositInfo(true)}
            className="group flex cursor-pointer items-center gap-3 rounded-cartao border border-borda bg-branco p-4 text-left text-verde transition-[border-color] duration-200 hover:border-borda-forte"
          >
            <HexTile icon={ShieldCheck} tone="salvia" size={44} flip />
            <span className="flex-1">
              <span className="block font-bold">Proteção Beeznoo</span>
              <span className="text-sm">Contrato, caução e fotos na entrega. Como funciona?</span>
            </span>
            <ChevronRight className="size-5 text-cinza transition-transform duration-200 ease-out group-hover:translate-x-1" strokeWidth={1.8} aria-hidden />
          </button>

          {item.description && (
            <section className="grid gap-2">
              <h2 className="font-titulo text-lg font-bold tracking-tight text-verde">Sobre o equipamento</h2>
              <p className="whitespace-pre-line text-texto-corpo">{item.description}</p>
            </section>
          )}

          {session?.role === "ADMIN" && (
            <Card className="flex items-center justify-between gap-3 border-dashed p-4">
              <span className="text-sm text-verde">
                <span className="block font-bold">Admin · Destaque</span>
                {item.featured ? "Aparece em \"Em destaque\" no Explorar." : "Não está em destaque."}
              </span>
              <Button variant="outline" size="sm" loading={featuring} onClick={toggleFeatured}>
                <Sparkles strokeWidth={1.8} /> {item.featured ? "Tirar destaque" : "Destacar"}
              </Button>
            </Card>
          )}

          {needsKyc && (
            <Callout tone="warn" title="Antes de pedir, verifica a tua identidade">
              É feito à mão pela equipa e pode demorar até 2 dias úteis. Só precisas de o fazer uma vez.
            </Callout>
          )}

          <StickyCTA
            aside={
              ctaBlocked ? (
                <p className="leading-tight text-verde">
                  <Kz value={item.pricePerDay} className="text-xl" />
                  <span className="text-[13px] text-cinza"> /dia</span>
                </p>
              ) : (
                // o total das datas é o número que decide (aluguer + taxa; a caução está no resumo acima)
                <p className="leading-tight text-verde">
                  <Kz value={rentalTotal} className="text-xl" />
                  <span className="block text-[13px] text-cinza">
                    {formatRange(start, end)} · {days} {days === 1 ? "dia" : "dias"}
                  </span>
                </p>
              )
            }
          >
            <div className="flex gap-2">
              <a href={whatsappLink(waText)} target="_blank" rel="noreferrer" aria-label={`Falar no WhatsApp sobre ${item.title}`} className={cn(buttonClass("secondary"), "w-12 px-0 md:w-auto md:px-5")}>
                <MessageCircle strokeWidth={1.8} />
                <span className="hidden md:inline">WhatsApp</span>
              </a>
              {needsKyc ? (
                <ButtonLink href="/verificacao" className="md:flex-1">
                  Verificar identidade
                </ButtonLink>
              ) : (
                <ButtonLink href={reserveHref} className={cn("md:flex-1", ctaBlocked ? "pointer-events-none opacity-50" : "")} aria-disabled={!!ctaBlocked}>
                  {ctaBlocked ?? "Pedir reserva"}
                </ButtonLink>
              )}
            </div>
          </StickyCTA>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 border-t border-borda pt-6 md:pt-8">
        <ReviewsSection itemId={id} average={item.ratingAverage} count={item.ratingCount} rentals={item.completedRentals} />
        {item.category && (
          <Rail
            title={`Mais em ${item.category.name}`}
            subtitle="Outros equipamentos da mesma categoria"
            icon={LayoutGrid}
            order="POPULAR"
            categoryId={item.category.id}
            keep={(i) => i.id !== id}
          />
        )}
      </div>

      <Sheet open={depositInfo} onClose={() => setDepositInfo(false)} title="Como funciona a caução">
        <DepositExplainer pricePerDay={Number(item.pricePerDay)} deposit={deposit} />
      </Sheet>
    </div>
  );
}

function DepositExplainer({ pricePerDay, deposit }: { pricePerDay: number; deposit: number }) {
  const steps = [
    { t: "Pagas ao dono, na entrega", d: `Aluguer + taxa + caução. Neste equipamento a caução é ${deposit.toLocaleString("de-DE")} Kz e fica com o dono durante o aluguer.` },
    { t: "Fotografam juntos na entrega", d: "A checklist com fotos regista o estado. Protege-te a ti e ao dono." },
    { t: "Devolves e o dono devolve a caução", d: "Se estiver tudo em ordem, a caução volta inteira para ti e o dono regista-o na app." },
    { t: "Se houver dano", d: "O dono pode reter parte, com motivo. Se não concordares, reportas até 7 dias depois e a equipa decide com base nas fotos." },
  ];
  return (
    <div className="grid gap-5 pt-2">
      <ol className="grid gap-4">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <HexTile tone="salvia" size={40} className="num text-verde">{i + 1}</HexTile>
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

// "2026-11-16" ou null (parâmetros do URL não são de confiança)
function validIso(v: string | null) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
