"use client";

import { useMemo, useState } from "react";
import { Flame, LayoutGrid, MapPin, PackageSearch, Search, Sparkles, SlidersHorizontal, Star, X } from "lucide-react";
import { HexGlow, categoryIcon } from "@/components/bz/brand";
import { PublishPromo, QuickSearches, Rail, TrustStrip } from "@/components/bz/discover";
import { CategoryTile, EquipmentCard } from "@/components/bz/equipment";
import { Sheet } from "@/components/bz/overlay";
import { EmptyState, ErrorState, GridSkeleton } from "@/components/bz/states";
import { Button } from "@/components/bz/ui";
import { catalogApi, totalPages } from "@/lib/api";
import { useSession } from "@/lib/auth";
import type { ItemCondition, ItemSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import BeeznoFilters from "../../../../components/items/Filters";

type Filters = { area?: string; maxPrice: number | ""; condition?: ItemCondition | "ANY" };

export default function ExplorarPage() {
  const session = useSession();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ maxPrice: "" });
  const [draft, setDraft] = useState<Filters>({ maxPrice: "" });
  const [sheet, setSheet] = useState(false);

  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const listKey = `items:${categoryId ?? "all"}`;
  const first = useResource(listKey, () => catalogApi.items({ categoryId, page: 0 }));
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
      const res = await catalogApi.items({ categoryId, page: page + 1 });
      setMore({ key: listKey, page: page + 1, items: [...(extra?.items ?? []), ...res.content] });
    } finally {
      setLoadingMore(false);
    }
  }

  // A API só filtra por categoria (ver BACKEND_GAPS): texto, bairro, preço e estado filtram o que já veio.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q)) &&
        (!filters.area || `${i.city ?? ""} ${i.province ?? ""}`.toLowerCase().includes(filters.area.toLowerCase())) &&
        (filters.maxPrice === "" || Number(i.pricePerDay) <= filters.maxPrice) &&
        (!filters.condition || filters.condition === "ANY" || i.condition === filters.condition),
    );
  }, [items, query, filters]);

  const activeFilters = [filters.area, filters.maxPrice !== "" ? 1 : null, filters.condition && filters.condition !== "ANY" ? 1 : null].filter(Boolean).length;
  const roots = categories.filter((c) => !c.parentId);
  // Faixas só ao navegar; com pesquisa ou filtros vai-se direto aos resultados
  const browsing = !query.trim() && activeFilters === 0;

  return (
    <div className="grid gap-5 md:gap-7">
      {/* Herói */}
      <BeeznoFilters value={filters}
        onChange={setFilters}
        categories={roots}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}/>
      <section className="relative -mx-4 -mt-5 overflow-hidden bg-verde-noite px-4 pt-6 pb-5 text-areia md:mx-0 md:mt-0 md:rounded-sheet md:px-10 md:py-10">
        <HexGlow />
        <div className="relative grid gap-4 md:max-w-2xl">
          <p className="text-sm font-medium text-salvia">{session ? "Bem-vindo de volta" : "Luanda · fotografia, vídeo e eventos"}</p>
          <h1 className="font-titulo text-[34px] leading-[1] font-extrabold tracking-tight md:text-[52px]">
            Do que precisas <span className="text-ambar">hoje?</span>
          </h1>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar equipamento</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
              <input
                type="search"
                placeholder="Câmara, lente, coluna, projetor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-14 w-full rounded-full bg-branco pr-4 pl-12 text-[15px] text-verde outline-none placeholder:text-cinza focus:ring-4 focus:ring-ambar/40"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setDraft(filters);
                setSheet(true);
              }}
              aria-label={`Filtros${activeFilters ? ` (${activeFilters} ativos)` : ""}`}
              className="relative flex size-14 shrink-0 items-center cursor-pointer justify-center rounded-full bg-ambar text-verde transition active:scale-95"
            >
              <SlidersHorizontal className="size-5" strokeWidth={2} aria-hidden />
              {activeFilters > 0 && (
                <span className="num absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-areia text-xs font-bold text-verde">{activeFilters}</span>
              )}
            </button>
          </div>
          <QuickSearches active={query} onPick={setQuery} />
        </div>
      </section>

      <TrustStrip />

      {/* Categorias em mosaico */}
      <section aria-label="Categorias" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-6 md:px-0">
        <CategoryTile label="Tudo" icon={LayoutGrid} active={!categoryId} onClick={() => setCategoryId(undefined)} tone={2} />
        {roots.map((c, i) => (
          <CategoryTile key={c.id} label={c.name} icon={categoryIcon(c.slug)} active={c.id === categoryId} onClick={() => setCategoryId(c.id)} tone={i} />
        ))}
      </section>

      {activeFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {filters.area && <FilterTag onClear={() => setFilters({ ...filters, area: undefined })}>{filters.area}</FilterTag>}
          {filters.maxPrice !== "" && (
            <FilterTag onClear={() => setFilters({ ...filters, maxPrice: "" })}>até {filters.maxPrice.toLocaleString("de-DE")} Kz/dia</FilterTag>
          )}
          {filters.condition && filters.condition !== "ANY" && (
            <FilterTag onClear={() => setFilters({ ...filters, condition: undefined })}>{filters.condition === "NEW" ? "Novo" : "Como novo"}</FilterTag>
          )}
        </div>
      )}

      {browsing && (
        <>
          <Rail title="Em destaque" subtitle="Escolhido pela equipa Beeznoo" icon={Sparkles} featured order="RECENT" categoryId={categoryId} />
          <Rail
            title="Mais alugados"
            subtitle="O que mais sai em Luanda"
            icon={Flame}
            order="POPULAR"
            categoryId={categoryId}
            keep={(i) => i.completedRentals > 0}
           
          />
          <Rail
            title="Mais bem avaliados"
            subtitle="Notas de quem já alugou"
            icon={Star}
            order="RATING"
            categoryId={categoryId}
            keep={(i) => i.ratingCount > 0}
           
          />
        </>
      )}

      <section aria-label="Equipamento" className="grid gap-4">
        <div className="flex items-end justify-between">
          <h2 className="font-titulo text-xl font-bold text-verde">
            {query.trim() ? `Resultados para "${query.trim()}"` : categoryId ? categories.find((c) => c.id === categoryId)?.name : "Todo o equipamento"}
          </h2>
          {state === "ready" && <span className="num text-[13px] text-cinza">{visible.length} resultados</span>}
        </div>

        {state === "loading" && <GridSkeleton />}
        {state === "error" && <ErrorState message={first.error!} onRetry={first.reload} />}
        {state === "ready" && visible.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="Nada por aqui ainda"
            text={query ? `Não encontrámos "${query}". Experimenta outra palavra ou outra categoria.` : "Ainda não há equipamento com estes filtros."}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategoryId(undefined);
                  setFilters({ maxPrice: "" });
                }}
              >
                Ver todo o equipamento
              </Button>
            }
          />
        )}
        {state === "ready" && visible.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
              {visible.map((item, i) => (
                <li key={item.id}>
                  <EquipmentCard item={item} href={`/equipamento/${item.id}`} index={i} />
                </li>
              ))}
            </ul>
            {page + 1 < pages && (
              <Button variant="outline" className="justify-self-center" loading={loadingMore} onClick={loadMore}>
                Ver mais
              </Button>
            )}
          </>
        )}
      </section>

      {browsing && state === "ready" && <PublishPromo />}

  {/*
  
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDraft({ maxPrice: "" })}>
              Limpar
            </Button>
            <Button
              variant="dark"
              block
              onClick={() => {
                setFilters(draft);
                setSheet(false);
              }}
            >
              Aplicar filtros
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 pt-2">
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm font-medium text-verde">
              <MapPin className="size-4 text-mel" strokeWidth={1.8} aria-hidden /> Bairro
            </p>
            <ChipGroup
              label="Bairro"
              value={draft.area}
              onChange={(v) => setDraft({ ...draft, area: draft.area === v ? undefined : v })}
              options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))}
            />
          </div>
          <MoneyField label="Preço máximo por dia" value={draft.maxPrice} onChange={(v) => setDraft({ ...draft, maxPrice: v })} hint="Deixa vazio para ver todos os preços." />
          <div className="grid gap-3">
            <p className="text-sm font-medium text-verde">Estado do equipamento</p>
            <ChipGroup<ItemCondition | "ANY">
              label="Estado"
              value={draft.condition ?? "ANY"}
              onChange={(v) => setDraft({ ...draft, condition: v })}
              options={[
                { value: "ANY", label: "Qualquer" },
                { value: "NEW", label: "Novo" },
                { value: "LIKE_NEW", label: "Como novo" },
              ]}
            />
          </div>
          <p className="text-[13px] text-cinza">Filtro por datas disponíveis chega quando a API tiver disponibilidade.</p>
        </div>
      </Sheet>
      */}
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filtros">
      <BeeznoFilters 
        mobile
        value={filters}
        onChange={setFilters}
        categories={roots}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}/>
</Sheet>
    </div>
  );
}

function FilterTag({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-verde pr-1 pl-3 font-medium text-areia">
      {children}
      <button type="button" onClick={onClear} aria-label={`Remover filtro ${children}`} className="flex size-7 items-center justify-center rounded-full hover:bg-white/10">
        <X className="size-4" strokeWidth={2} />
      </button>
    </span>
  );
}
