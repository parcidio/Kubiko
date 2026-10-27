"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronRight, Clock, LayoutGrid, MapPin, MessageCircle, Repeat2, ShieldCheck, Sparkles } from "lucide-react";
import { categoryIcon } from "@/components/bz/brand";
import { PriceSummary } from "@/components/bz/booking";
import { Rail, ReviewsSection } from "@/components/bz/discover";
import { Avatar, ConditionMeter, ItemPhoto, Stars, formatRating, placeOf } from "@/components/bz/equipment";
import { TextField } from "@/components/bz/form";
import { Sheet, toast } from "@/components/bz/overlay";
import { StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Badge, Button, ButtonLink, Card, Eyebrow, Kz, Skeleton, buttonClass } from "@/components/bz/ui";
import { adminApi, catalogApi } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { whatsappLink } from "@/lib/booking";
import { addDaysIso, daysBetween, formatRange, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { Item } from "@/lib/types";

export default function EquipamentoPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const { data: item, error, reload, setData } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));
  const [featuring, setFeaturing] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);
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
    <div className="grid gap-5 md:gap-8">
      <div className="hidden md:block">
        <BackLink href="/explorar">Explorar</BackLink>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10">
        {/* Galeria: deslizar no telemóvel */}
        <div className="-mx-4 -mt-5 grid content-start gap-3 md:sticky md:top-24 md:mx-0 md:mt-0 md:self-start">
          <div className="relative">
            <div
              ref={gallery}
              className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:rounded-sheet"
              onScroll={(e) => setPhoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            >
              {(photos.length ? photos : [null]).map((p, i) => (
                <ItemPhoto key={p?.id ?? i} src={p?.photUrl} alt={`${item.title} — foto ${i + 1}`} icon={Icon} rounded={false} className="w-full shrink-0 snap-center" />
              ))}
            </div>
            {photos.length > 1 && (
              <>
                <span className="num absolute top-4 right-4 rounded-full bg-verde/80 px-3 py-1 text-[13px] font-bold text-areia backdrop-blur">
                  {photo + 1} / {photos.length}
                </span>
                <span aria-hidden className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {photos.map((p, i) => (
                    <span key={p.id} className={cn("h-1.5 rounded-full bg-branco transition-all", i === photo ? "w-5" : "w-1.5 opacity-60")} />
                  ))}
                </span>
              </>
            )}
            {item.featured && (
              <span className="absolute top-4 left-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-verde px-3 text-[13px] font-bold text-ambar md:top-4 md:left-4">
                <Sparkles className="size-4" strokeWidth={2} aria-hidden /> Em destaque
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
                  className={cn("w-20 overflow-hidden rounded-campo border-2 transition", i === photo ? "border-verde" : "border-transparent opacity-70 hover:opacity-100")}
                >
                  <ItemPhoto src={p.photUrl} alt="" icon={Icon} rounded={false} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.category && <Badge tone="analise" icon={Icon}>{item.category.name}</Badge>}
              {!available && <Badge tone="neutro">Indisponível</Badge>}
            </div>
            <h1 className="font-titulo text-[30px] leading-[1.05] font-extrabold tracking-tight text-verde md:text-[40px]">{item.title}</h1>
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

      <div className="grid gap-8 border-t border-borda pt-6 md:pt-8">
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
