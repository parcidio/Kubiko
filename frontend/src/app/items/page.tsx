"use client";

import { useState, Suspense } from "react";
import { SlidersHorizontal, X, ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import BeeznoFilters, { EMPTY_FILTERS, type Filters } from "../../../components/arrendatario/Filters";
import BeeznoItems from "../../../components/arrendatario/Items";

// useSearchParams precisa de Suspense no App Router
function ArrendatarioInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Inicializa com a categoria vinda da URL (ex: ?categoria=Fotografia)
  const categoriaParam = searchParams.get("categoria");
  const [activeFilters, setActiveFilters] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    categorias: categoriaParam ? [categoriaParam] : [],
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-2 py-16 sm:px-8">

        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-1.5 text-sm font-semibold cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </button>

        <button
          onClick={() => setDrawerOpen(true)}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border-bg bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-card lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </button>

        <div className="flex items-start gap-6">
          <div className="hidden lg:block">
            <BeeznoFilters
              onSave={setActiveFilters}
              initialFilters={activeFilters}
            />
          </div>
          <BeeznoItems filters={activeFilters} />
        </div>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-background shadow-lift transition-transform duration-300 ease-out lg:hidden ${drawerOpen ? "translate-y-0" : "translate-y-full"}`}>
        <div className="relative flex items-center justify-between border-b border-border-bg px-6 py-4">
          <div className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <h2 className="font-semibold text-foreground">Filtros</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-bg bg-secondary"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <BeeznoFilters
            mobile
            onSave={(f) => { setActiveFilters(f); setDrawerOpen(false); }}
            initialFilters={activeFilters}
          />
        </div>
      </div>
    </div>
  );
}

export default function Arrendatario() {
  return (
    <Suspense>
      <ArrendatarioInner />
    </Suspense>
  );
}