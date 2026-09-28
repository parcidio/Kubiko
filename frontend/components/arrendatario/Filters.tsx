"use client";

import { Banknote, Search, Bookmark, Calendar, ChevronDown } from "lucide-react";

const stats = [
  { icon: Search,   label: "Pesquisar"  },
  { icon: Bookmark, label: "Categoria"  },
  { icon: Banknote, label: "Preço"      },
  { icon: Calendar, label: "Datas"      },
];

interface BeeznoFiltersProps {
  mobile?: boolean;
}

export default function BeeznoFilters({ mobile = false }: BeeznoFiltersProps) {
  const content = (
    // ← "fixed" removido daqui (estava errado — o aside já trata do posicionamento)
    <div className="rounded-lg border border-border-bg bg-card">

      {/* Cabeçalho — esconde em mobile (o drawer já tem) */}
      {!mobile && (
        <div className="flex justify-center border-b border-border-bg px-6 py-1.5">
          <h2 className="font-light text-card-foreground">Filtros</h2>
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">

        {/* Preferências actuais */}
        <div className="rounded-xl bg-accent px-5 py-6">
          <h3 className="font-bold text-accent-foreground">As tuas preferências</h3>
        </div>

        {/* Editar preferências */}
        <div className="rounded-lg bg-background px-5 py-6">
          <h3 className="font-bold text-foreground">Editar preferências</h3>

          {stats.map(({ icon: Icon, label }) => (
            <button
              key={label}
              className={`mt-4 flex w-full cursor-pointer items-center justify-between ${
                mobile ? "py-2" : ""  // ← mais espaço de toque em mobile
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`text-muted-foreground ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
                <span className={`font-semibold text-foreground ${mobile ? "text-base" : "text-sm"}`}>
                  {label}
                </span>
              </div>
              <ChevronDown className={`text-muted-foreground transition-transform duration-200 ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
            </button>
          ))}

          <button className="group relative mt-6 w-full cursor-pointer overflow-hidden rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-shadow duration-300 hover:shadow-lift">
            <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
            <span className={`relative ${mobile ? "text-base" : "text-sm"}`}>Guardar</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Desktop — sticky sidebar (sem alterações)
  if (!mobile) {
    return <aside className="w-72 shrink-0 sticky top-24">{content}</aside>;
  }

  // Mobile — sem wrapper extra
  return <div>{content}</div>;
}