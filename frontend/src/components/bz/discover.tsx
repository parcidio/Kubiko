"use client";

import { useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Camera, ChevronLeft, ChevronRight, MessageSquareText, ShieldCheck, type LucideIcon } from "lucide-react";
import { HexGlow } from "./brand";
import { Avatar, EquipmentCard, Stars, formatRating } from "./equipment";
import { ButtonLink, Skeleton, Button } from "./ui";
import { catalogApi } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { ItemOrder, ItemSummary, Review } from "@/lib/types";

// ── Faixa horizontal de equipamento ──────────────────────────────────────
// Só aparece se tiver itens: com pouco inventário não mostramos faixas vazias.

export function Rail({
  title, subtitle, icon: Icon, categoryId, featured, order, keep,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  categoryId?: string;
  featured?: boolean;
  order: ItemOrder;
  /** Filtra o que veio (ex.: só itens já alugados em "Mais alugados"). */
  keep?: (item: ItemSummary) => boolean;
}) {
  const key = `rail:${order}:${featured ? "f" : ""}:${categoryId ?? "all"}`;
  const { data, loading } = useResource(key, () => catalogApi.items({ categoryId, featured, order, size: 10 }));
  const scroller = useRef<HTMLUListElement>(null);
  const items = (data?.content ?? []).filter(keep ?? (() => true));

  if (loading) return <RailSkeleton title={title} />;
  if (items.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section aria-label={title} className="grid animate-sobe gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ambar-tint text-mel">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <h2 className="font-titulo text-lg leading-tight font-bold text-verde md:text-xl">{title}</h2>
            {subtitle && <p className="text-[13px] text-cinza">{subtitle}</p>}
          </div>
        </div>
        {items.length > 3 && (
          <div className="hidden gap-1 md:flex">
            <ArrowButton label={`${title}: anteriores`} icon={ChevronLeft} onClick={() => scrollBy(-1)} />
            <ArrowButton label={`${title}: seguintes`} icon={ChevronRight} onClick={() => scrollBy(1)} />
          </div>
        )}
      </div>
      <ul ref={scroller} className="faixa -mx-4 gap-3 px-4 pb-1 md:mx-0 md:gap-4 md:px-0">
        {items.map((item, i) => (
          <li key={item.id} className="w-[44vw] max-w-[240px] min-w-[160px] shrink-0 md:w-[240px]">
            <EquipmentCard item={item} href={`/equipamento/${item.id}`} index={i} showFeatured={!featured} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ArrowButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-borda bg-branco text-verde transition hover:border-verde active:scale-95"
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

function RailSkeleton({ title }: { title: string }) {
  return (
    <div role="status" aria-label={`A carregar ${title}`} className="grid gap-3">
      <Skeleton className="h-6 w-44" />
      <div className="faixa -mx-4 gap-3 px-4 md:mx-0 md:px-0">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid w-[44vw] max-w-[240px] min-w-[160px] shrink-0 gap-2 md:w-[240px]">
            <Skeleton className="aspect-[4/3] rounded-cartao" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Porque podes confiar (uma linha, sem promessas falsas) ──────────────

const TRUST: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BadgeCheck, title: "Donos verificados", text: "Identidade confirmada pela equipa" },
  { icon: ShieldCheck, title: "Pagamento protegido", text: "Fica com a Beeznoo até receberes" },
  { icon: Camera, title: "Fotos na entrega", text: "Checklist e contrato em cada aluguer" },
];

export function TrustStrip({ className }: { className?: string }) {
  return (
    <ul aria-label="Como a Beeznoo te protege" className={cn("faixa -mx-4 gap-2 px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:px-0", className)}>
      {TRUST.map(({ icon: Icon, title, text }, i) => (
        <li
          key={title}
          className="flex w-[78vw] max-w-[300px] shrink-0 animate-sobe items-center gap-3 rounded-cartao border border-borda bg-branco p-3 md:w-auto md:max-w-none"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-salvia-tint text-verde-medio">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-verde">{title}</span>
            <span className="block text-[13px] leading-tight text-cinza">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Pesquisas rápidas no herói ───────────────────────────────────────────

export const QUICK_SEARCHES = ["Sony", "Drone", "Coluna", "Projetor", "Microfone", "Tenda"];

export function QuickSearches({ onPick, active }: { onPick: (q: string) => void; active: string }) {
  return (
    <div className="faixa -mx-4 gap-2 px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="Pesquisas frequentes">
      {QUICK_SEARCHES.map((q) => {
        const on = active.trim().toLowerCase() === q.toLowerCase();
        return (
          <button
            key={q}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? "" : q)}
            className={cn(
              "h-11 shrink-0 rounded-full cursor-pointer border px-4 text-sm font-medium transition active:scale-95",
              on ? "border-ambar bg-ambar/15 text-ambar" : "border-white/15 bg-white/5 text-areia hover:bg-white/10",
            )}
          >
            {q}
          </button>
        );
      })}
    </div>
  );
}

// ── Bloco editorial: convite a publicar (da Beeznoo, não é anúncio) ──────

export function PublishPromo() {
  return (
    <section className="relative overflow-hidden rounded-sheet bg-verde p-5 text-areia md:flex md:items-center md:justify-between md:gap-8 md:p-8">
      <HexGlow />
      <div className="relative grid gap-1.5 md:max-w-lg">
        <p className="text-xs font-bold tracking-[0.1em] text-salvia uppercase">Para donos</p>
        <h2 className="font-titulo text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">
          Tens equipamento parado? <span className="text-ambar">Põe-no a render.</span>
        </h2>
        <p className="text-sm text-areia/80">Publicas com fotos e preço, aceitas só os pedidos que quiseres e recebes por cada aluguer.</p>
      </div>
      <ButtonLink href="/publicar" variant="light" className="relative mt-4 md:mt-0">
        Publicar equipamento <ArrowRight strokeWidth={1.8} />
      </ButtonLink>
    </section>
  );
}

// ── Avaliações no Detalhe ─────────────────────────────────────────────────

export function ReviewsSection({
  itemId, average, count, rentals,
}: { itemId: string; average: number | null; count: number; rentals: number }) {
  const first = useResource(`reviews:${itemId}`, () => catalogApi.reviews(itemId, 0));
  const [more, setMore] = useState<Review[]>([]);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const reviews = [...(first.data?.content ?? []), ...more];
  const hasMore = reviews.length < count;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await catalogApi.reviews(itemId, page + 1);
      setMore((m) => [...m, ...res.content]);
      setPage((p) => p + 1);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section aria-labelledby="avaliacoes" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="avaliacoes" className="font-titulo text-lg font-bold text-verde md:text-xl">Avaliações</h2>
        {rentals > 0 && <p className="num text-[13px] text-cinza">Alugado {rentals} {rentals === 1 ? "vez" : "vezes"} na Beeznoo</p>}
      </div>

      {average && count > 0 ? (
        <div className="flex items-center gap-4 rounded-cartao bg-areia-2 p-4">
          <span className="num font-titulo text-5xl leading-none font-extrabold tracking-tight text-verde">{formatRating(average)}</span>
          <span className="grid gap-1">
            <Stars value={average} />
            <span className="text-sm text-cinza">
              {count} {count === 1 ? "avaliação" : "avaliações"} de quem já alugou
            </span>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-cartao border border-dashed border-borda-forte p-4 text-sm text-cinza">
          <MessageSquareText className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
          Ainda sem avaliações. Quem alugar primeiro conta como correu.
        </div>
      )}

      {count > 0 && first.loading && (
        <div role="status" aria-label="A carregar avaliações" className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-cartao" />
          ))}
        </div>
      )}
      {first.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-cartao bg-erro-tint p-3 text-sm text-erro">
          Não conseguimos carregar as avaliações.
          <Button size="sm" variant="danger" onClick={first.reload}>
            Tentar outra vez
          </Button>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {reviews.map((r, i) => (
            <li key={r.id} className="grid animate-sobe content-start gap-2 rounded-cartao border border-borda bg-branco p-4" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <div className="flex items-center gap-3">
                <Avatar name={r.reviewerName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-verde">{r.reviewerName}</p>
                  <p className="text-[13px] text-cinza">{formatDay(r.createdAt)}</p>
                </div>
                <Stars value={r.rating} size="sm" />
              </div>
              {r.comment && <p className="text-[15px] text-texto-corpo">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {hasMore && first.data && (
        <Button variant="outline" className="justify-self-start" loading={loadingMore} onClick={loadMore}>
          Ver mais avaliações
        </Button>
      )}
    </section>
  );
}
