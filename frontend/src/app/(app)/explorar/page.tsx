"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemPhoto } from "@/components/beeznoo/booking-ui";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/beeznoo/states";
import { catalogApi, totalPages } from "@/lib/api";
import { CONDITION_LABEL, formatKz } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemSummary } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

export default function ExplorarPage() {
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const categories = useResource("categories", () => catalogApi.categories()).data ?? [];
  const listKey = `items:${categoryId ?? "all"}`;
  const first = useResource(listKey, () => catalogApi.items({ categoryId, page: 0 }));
  // Páginas seguintes ("Ver mais"), válidas só para a categoria em que foram pedidas
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

  // A API ainda não tem pesquisa por texto: filtramos o que já foi carregado.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const chips = [{ id: undefined as string | undefined, name: "Tudo" }, ...categories.filter((c) => !c.parentId)];

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="font-heading text-[26px] text-verde md:text-[32px]">Explorar</h1>
        <p className="text-cinza">Por que comprar quando podes alugar?</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-cinza" strokeWidth={1.8} aria-hidden />
        <Input
          type="search"
          placeholder="Procura câmara, lente, coluna…"
          aria-label="Pesquisar equipamento"
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Categorias">
        {chips.map((c) => {
          const active = c.id === categoryId;
          return (
            <button
              key={c.id ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "h-11 shrink-0 rounded-full border px-4 text-sm whitespace-nowrap",
                active ? "border-verde bg-verde text-areia" : "border-borda-forte bg-branco text-verde hover:bg-areia-2",
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {state === "loading" && <CardGridSkeleton />}
      {state === "error" && <ErrorState message={first.error!} onRetry={first.reload} />}
      {state === "ready" && visible.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="Nada por aqui ainda"
          text={query ? `Não encontrámos "${query}". Experimenta outra palavra ou outra categoria.` : "Ainda não há equipamento nesta categoria."}
          action={
            <Button variant="outline" onClick={() => { setQuery(""); setCategoryId(undefined); }}>
              Ver todo o equipamento
            </Button>
          }
        />
      )}
      {state === "ready" && visible.length > 0 && (
        <>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/equipamento/${item.id}`}
                  className="block overflow-hidden rounded-bz-md border border-borda bg-branco transition-colors hover:border-borda-forte focus-visible:ring-[3px] focus-visible:ring-verde-medio/30 focus-visible:outline-none"
                >
                  <ItemPhoto src={item.coverPhoto} alt={item.title} />
                  <div className="grid gap-1 p-3">
                    <h2 className="line-clamp-2 font-heading text-base leading-snug text-verde md:text-lg">{item.title}</h2>
                    <p className="flex items-center gap-1 text-[13px] text-cinza">
                      <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
                      <span className="truncate">{[item.city, item.province].filter(Boolean).join(", ") || "Luanda"}</span>
                    </p>
                    <p className="text-[13px] text-cinza">{CONDITION_LABEL[item.condition] ?? item.condition}</p>
                    <p className="mt-1 text-verde">
                      <span className="font-heading text-lg">{formatKz(item.pricePerDay)}</span>
                      <span className="text-[13px] text-cinza"> /dia</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {page + 1 < pages && (
            <Button variant="outline" className="justify-self-center" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "A carregar…" : "Ver mais"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
