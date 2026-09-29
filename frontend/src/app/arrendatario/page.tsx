"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import BeeznoFilters from "../../../components/arrendatario/Filters";
import BeeznoItems from "../../../components/arrendatario/Items";

export default function Arrendatario() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-2 py-16 sm:px-8">

        {/* Botão filtros — só mobile */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="mb-5 flex items-center gap-2 rounded-lg border border-border-bg bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-card lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </button>

        {/* Layout desktop */}
        <div className="flex items-start gap-6">
          <div className="hidden lg:block">
            <BeeznoFilters />
          </div>
          <BeeznoItems />
        </div>
      </div>

      {/* ── Drawer mobile ── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Painel — sobe do fundo */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-background shadow-lift transition-transform duration-300 ease-out lg:hidden ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle + cabeçalho */}
        <div className="flex items-center justify-between border-b border-border-bg px-6 py-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border absolute top-3 left-1/2 -translate-x-1/2" />
          <h2 className="font-semibold text-foreground">Filtros</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-bg bg-secondary"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo do filtro */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <BeeznoFilters mobile />
        </div>
      </div>
    </div>
  );
}