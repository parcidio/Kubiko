"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, LayoutGrid, PackageSearch, Search, Sparkles, SlidersHorizontal, Star, X } from "lucide-react";
import { HexGlow, categoryIcon } from "@/components/bz/brand";
import { PublishPromo, QuickSearches, Rail, TrustStrip } from "@/components/bz/discover";
import { CategoryChip, EquipmentCard } from "@/components/bz/equipment";
import { Sheet } from "@/components/bz/overlay";
import { EmptyState, ErrorState, GridSkeleton } from "@/components/bz/states";
import { Button } from "@/components/bz/ui";
import { catalogApi, totalPages } from "@/lib/api";
import { addDaysIso, formatRange, todayIso } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { fmt, plural } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import type { ItemCondition, ItemSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import BeeznoFilters, { type Filters } from "../../../../components/items/Filters";


export default function ExplorarPage() {
  return (
    <Suspense>
      <Explorar />
    </Suspense>
  );
}

/** Sem acentos nem maiúsculas: "Vídeo" na landing = "video" na categoria. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function Explorar() {
  const session = useSession();
  const lang = useLang();
  const dict = useT();
  const t = dict.explore;
  const wanted = useSearchParams().get("categoria");
  // null = ainda não escolheu: vale a categoria do link (landing → /explorar?categoria=Fotografia)
  const [chosen, setChosen] = useState<string | undefined | null>(null);
  const setCategoryId = (id: string | undefined) => setChosen(id);
  const [query, setQuery] = useState("");
  // a pesquisa vai ao servidor 300 ms depois de parar de escrever
  const [searched, setSearched] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearched(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const [filters, setFilters] = useState<Filters>({ maxPrice: "" });
  const [sheet, setSheet] = useState(false);

  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const fromUrl = wanted ? categories.find((c) => norm(c.name) === norm(wanted) || c.slug === norm(wanted))?.id : undefined;
  const categoryId = chosen === null ? fromUrl : chosen;
  // Datas filtram no servidor (só equipamento livre); o resto ainda filtra no cliente
  const dates = filters.dataInicio && filters.dataFim ? { startDate: filters.dataInicio, endDate: filters.dataFim } : {};
  // Tudo filtra no servidor (#17): resultados e contagem são os verdadeiros, com qualquer número de páginas
  const search = {
    ...dates,
    text: searched || undefined,
    area: filters.area || undefined,
    maxPrice: filters.maxPrice === "" ? undefined : filters.maxPrice,
    condition: filters.condition && filters.condition !== "ANY" ? (filters.condition as ItemCondition) : undefined,
  };
  const listKey = `items:${categoryId ?? "all"}:${JSON.stringify(search)}`;
  const first = useResource(listKey, () => catalogApi.items({ categoryId, page: 0, ...search }));
  const [more, setMore] = useState<{ key: string; page: number; items: ItemSummary[] } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const extra = more?.key === listKey ? more : null;
  const items = useMemo(() => [...(first.data?.content ?? []), ...(extra?.items ?? [])], [first.data, extra]);
  const page = extra?.page ?? 0;
  const pages = first.data ? totalPages(first.data) : 1;
  const state = first.error ? "error" : first.loading ? "loading" : "ready";

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await catalogApi.items({ categoryId, page: page + 1, ...search });
      setMore({ key: listKey, page: page + 1, items: [...(extra?.items ?? []), ...res.content] });
    } finally {
      setLoadingMore(false);
    }
  }

  const visible = items;
  const total = first.data?.page?.totalElements ?? items.length;

  const activeFilters = [filters.area, filters.maxPrice !== "" ? 1 : null, filters.condition && filters.condition !== "ANY" ? 1 : null, filters.dataInicio ? 1 : null].filter(Boolean).length;
  const roots = categories.filter((c) => !c.parentId);
  // Faixas só ao navegar; com pesquisa ou filtros vai-se direto aos resultados
  const browsing = !query.trim() && activeFilters === 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 px-4 md:gap-7 md:px-12">
      {/* Herói */}
      {/* No telemóvel o herói é compacto: o primeiro equipamento tem de aparecer cedo (revisão de UX 2026-11-15) */}
      {/* O herói sobe para trás do TopBar (-mt = pt do <main> + 4rem do cabeçalho) e o cabeçalho fica transparente
          por cima dele (HERO_ROUTES no shell.tsx); ao primeiro scroll para baixo volta ao normal */}
      <section
        className="hero-explore relative -mx-4 -mt-21 flex items-center overflow-hidden rounded-b-sheet bg-verde-noite px-4 pt-22 pb-6 text-areia md:-mx-12 md:-mt-24 md:min-h-[calc(min(60svh,560px)+4rem)] md:rounded-none md:px-12 md:pt-30 md:pb-14"
      >
        <HexGlow />
        {/* min-w-0: item de flex — sem isto a faixa de pesquisas rápidas alarga a página a 360–390px */}
        <div className="relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:max-w-2xl">
          <p className="text-xs font-bold tracking-[0.12em] text-salvia uppercase">{session ? t.welcomeBack : t.eyebrow}</p>
          <h1 className="font-titulo text-[34px] leading-[1.02] font-extrabold tracking-tight text-white md:text-[56px]">
            {t.titleBefore}<span className="text-salvia">{t.titleAccent}</span>
          </h1>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
              <input
                type="search"
                placeholder={t.searchPh}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-14 w-full rounded-campo border-[1.5px] border-transparent bg-branco pr-4 pl-12 text-[15px] text-verde outline-none transition placeholder:text-cinza focus:border-salvia focus:ring-4 focus:ring-salvia/40"
              />
            </label>
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={activeFilters ? fmt(t.filtersActive, { n: activeFilters }) : t.filters}
              className="relative flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-campo bg-branco text-verde transition-transform duration-200 active:scale-95 md:hidden"
            >
              <SlidersHorizontal className="size-5" strokeWidth={1.8} aria-hidden />
              {activeFilters > 0 && (
                <span className="num absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-verde-noite bg-salvia text-xs font-bold text-verde">{activeFilters}</span>
              )}
            </button>
          </div>
          {/* "Quando?" — quem aluga sabe as datas primeiro; a API devolve só o equipamento livre nesses dias */}
          {/* fieldset e input[type=date] têm largura mínima própria: min-w-0 e minmax(0,1fr) deixam-nos encolher */}
          <fieldset className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <legend className="sr-only">{t.when}</legend>
            <label className="grid min-w-0 gap-1">
              <span className="text-[13px] font-medium text-salvia-tint">{t.pickup}</span>
              <input
                type="date"
                min={todayIso()}
                value={filters.dataInicio ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return setFilters({ ...filters, dataInicio: undefined, dataFim: undefined });
                  setFilters({ ...filters, dataInicio: v, dataFim: filters.dataFim && filters.dataFim > v ? filters.dataFim : addDaysIso(v, 1) });
                }}
                className="h-12 w-full min-w-0 rounded-campo border-[1.5px] border-transparent bg-branco px-3 text-[15px] text-verde outline-none transition focus:border-salvia focus:ring-4 focus:ring-salvia/40"
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-[13px] font-medium text-salvia-tint">{t.dropoff}</span>
              <input
                type="date"
                min={filters.dataInicio ? addDaysIso(filters.dataInicio, 1) : todayIso(1)}
                value={filters.dataFim ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return setFilters({ ...filters, dataInicio: undefined, dataFim: undefined });
                  setFilters({ ...filters, dataFim: v, dataInicio: filters.dataInicio && filters.dataInicio < v ? filters.dataInicio : addDaysIso(v, -1) });
                }}
                className="h-12 w-full min-w-0 rounded-campo border-[1.5px] border-transparent bg-branco px-3 text-[15px] text-verde outline-none transition focus:border-salvia focus:ring-4 focus:ring-salvia/40"
              />
            </label>
          </fieldset>
          <QuickSearches active={query} onPick={setQuery} />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <BeeznoFilters value={filters} onChange={setFilters} categories={roots} categoryId={categoryId} onCategoryChange={setCategoryId} />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-7">
          {/* No telemóvel a faixa de confiança passa para depois dos resultados */}
          <div className="hidden md:block"><TrustStrip /></div>

          {/* Categorias em pills (v4): ativa = verde com ícone âmbar */}
          <section aria-label={t.categories} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
            <CategoryChip label={t.all} icon={LayoutGrid} active={!categoryId} onClick={() => setCategoryId(undefined)} />
            {roots.map((c) => (
              <CategoryChip key={c.id} label={c.name} icon={categoryIcon(c.slug)} active={c.id === categoryId} onClick={() => setCategoryId(c.id)} />
            ))}
          </section>

          {activeFilters > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
          {filters.area && <FilterTag onClear={() => setFilters({ ...filters, area: undefined })}>{filters.area}</FilterTag>}
          {filters.maxPrice !== "" && (
            <FilterTag onClear={() => setFilters({ ...filters, maxPrice: "" })}>{fmt(t.upTo, { price: filters.maxPrice.toLocaleString("de-DE") })}</FilterTag>
          )}
          {filters.condition && filters.condition !== "ANY" && (
            <FilterTag onClear={() => setFilters({ ...filters, condition: undefined })}>{dict.condition[filters.condition]}</FilterTag>
          )}
          {filters.dataInicio && filters.dataFim && (
            <FilterTag onClear={() => setFilters({ ...filters, dataInicio: undefined, dataFim: undefined })}>{fmt(t.freeOn, { range: formatRange(filters.dataInicio, filters.dataFim, lang) })}</FilterTag>
          )}
            </div>
          )}

          {browsing && (
            <>
          <Rail title={t.featured} subtitle={t.featuredSub} icon={Sparkles} featured order="RECENT" categoryId={categoryId} />
          <Rail
            title={t.popular}
            subtitle={t.popularSub}
            icon={Flame}
            order="POPULAR"
            categoryId={categoryId}
            keep={(i) => i.completedRentals > 0}
           
          />
          <Rail
            title={t.topRated}
            subtitle={t.topRatedSub}
            icon={Star}
            order="RATING"
            categoryId={categoryId}
            keep={(i) => i.ratingCount > 0}
           
          />
            </>
          )}

          <section aria-label={t.equipment} className="grid gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-titulo text-[19px] font-bold tracking-tight text-verde md:text-2xl">
            {query.trim() ? fmt(t.resultsFor, { q: query.trim() }) : categoryId ? categories.find((c) => c.id === categoryId)?.name : t.allEquipment}
          </h2>
          {state === "ready" && <span className="num text-[13px] text-cinza">{plural(total, t.results)}</span>}
        </div>

        {state === "loading" && <GridSkeleton />}
        {state === "error" && <ErrorState message={first.error!} onRetry={first.reload} />}
        {state === "ready" && visible.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title={t.emptyTitle}
            text={query ? fmt(t.emptyQuery, { q: query }) : t.emptyFilters}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategoryId(undefined);
                  setFilters({ maxPrice: "" });
                }}
              >
                {t.seeAll}
              </Button>
            }
          />
        )}
        {state === "ready" && visible.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5">
              {visible.map((item, i) => (
                <li key={item.id}>
                  <EquipmentCard
                    item={item}
                    href={filters.dataInicio && filters.dataFim ? `/equipamento/${item.id}?de=${filters.dataInicio}&ate=${filters.dataFim}` : `/equipamento/${item.id}`}
                    dates={filters.dataInicio && filters.dataFim ? { start: filters.dataInicio, end: filters.dataFim } : undefined}
                    index={i}
                  />
                </li>
              ))}
            </ul>
            {page + 1 < pages && (
              <Button variant="outline" className="justify-self-center" loading={loadingMore} onClick={loadMore}>
                {t.more}
              </Button>
            )}
          </>
        )}
          </section>

          <div className="md:hidden"><TrustStrip /></div>
          {browsing && state === "ready" && <PublishPromo />}
        </div>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t.filters}>
        <BeeznoFilters mobile onApplied={() => setSheet(false)} value={filters} onChange={setFilters} categories={roots} categoryId={categoryId} onCategoryChange={setCategoryId} />
      </Sheet>
    </div>
  );
}

function FilterTag({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  const t = useT().explore;
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-areia-2 pr-1 pl-3 text-[13px] font-medium text-verde">
      {children}
      <button type="button" onClick={onClear} aria-label={fmt(t.removeFilter, { name: String(children) })} className="-my-1 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-skeleton">
        <X className="size-4" strokeWidth={2} />
      </button>
    </span>
  );
}
