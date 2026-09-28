"use client";

import { Bookmark, Star } from "lucide-react";
import { catalogo } from "@/lib/marketplace";
import { EMPTY_FILTERS, type Filters } from "./Filters";

interface BeeznoItemsProps {
  filters?: Filters;
}

export default function BeeznoItems({ filters = EMPTY_FILTERS }: BeeznoItemsProps) {
  // ── Aplicar filtros ──────────────────────────────────────────
  const filtered = catalogo.filter(item => {
    if (filters.pesquisa &&
      !item.nome.toLowerCase().includes(filters.pesquisa.toLowerCase()))
      return false;

    if (filters.categorias.length > 0 &&
      !filters.categorias.includes(item.categoria))
      return false;

    if (filters.precoMin && item.precoPorDia < Number(filters.precoMin))
      return false;

    if (filters.precoMax && item.precoPorDia > Number(filters.precoMax))
      return false;

    // Datas: quando há datas seleccionadas, só mostra itens disponíveis
    if ((filters.dataInicio || filters.dataFim) && !item.disponivel)
      return false;

    return true;
  });

  return (
    <div className="flex-1 min-w-0 px-4 sm:px-0">

      {/* Contagem de resultados */}
      <p className="mb-4 text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "item encontrado" : "itens encontrados"}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-bg bg-card py-20 text-center">
          <p className="text-base font-semibold text-foreground">Nenhum item encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Tenta ajustar os filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative h-64 sm:h-84 cursor-pointer overflow-hidden rounded-sm border border-border-bg"
            >
              <img
                src={item.foto}
                alt={item.nome}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-x-0 bottom-0 h-full translate-y-[52%] bg-card p-3 sm:p-5 transition-transform duration-300 ease-out group-hover:translate-y-0 group-hover:delay-1500">

                {/* PEEK */}
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <h2 className="line-clamp-2 text-xs sm:text-base font-bold leading-snug text-foreground">
                    {item.nome}
                  </h2>
                  <div className="items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      <Bookmark className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-shield" />
                      <h1 className="font-semibold">{item.categoria}</h1>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-foreground">
                      {item.precoPorDia.toLocaleString("pt-AO")} Kz
                      <span className="text-[10px] sm:text-xs font-normal text-muted-foreground"> /dia</span>
                    </p>
                  </div>
                  <button
                    disabled={!item.disponivel}
                    className="w-full rounded-sm cursor-pointer bg-primary py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/85 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {item.disponivel ? "Reservar" : "Indisponível"}
                  </button>
                </div>

                {/* HOVER */}
                <div className="mt-3 sm:mt-4 flex flex-col gap-2 sm:gap-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-150">
                  <div className="h-px bg-border-bg" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-warning text-warning" />
                      <span className="font-semibold text-foreground">{item.avaliacao}</span>
                      <span>/ 5.0</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${
                      item.disponivel ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {item.disponivel ? "Disponível" : "Indisponível"}
                    </span>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">
                    {item.precoPorDia.toLocaleString("pt-AO")} Kz
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground"> /dia</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}