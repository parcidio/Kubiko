"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Bookmark, Calendar, ChevronDown, ChevronLeft, MapPin, Star } from "lucide-react";
import { ChipGroup } from "@/components/bz/form";
import { LUANDA_AREAS } from "@/lib/format";
import type { ItemCondition } from "@/lib/types";

// Mesmo contrato do backend; a página importa daqui
export type Filters = { area?: string; maxPrice: number | ""; condition?: ItemCondition | "ANY" };
export const EMPTY_FILTERS: Filters = { maxPrice: "" };

type CategoryOption = { id: string; name: string };

const CONDITION_LABEL: Partial<Record<ItemCondition, string>> = { NEW: "Novo", LIKE_NEW: "Como novo" };

const inputCls =
  "w-full rounded-lg border border-border-bg bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-shield disabled:cursor-not-allowed disabled:opacity-60";

function buildChips(f: Filters, categoryName?: string): string[] {
  const chips: string[] = [];
  if (categoryName) chips.push(categoryName);
  if (f.area) chips.push(f.area);
  if (f.maxPrice !== "") chips.push(`até ${f.maxPrice.toLocaleString("de-DE")} Kz/dia`);
  if (f.condition && f.condition !== "ANY") chips.push(CONDITION_LABEL[f.condition] ?? f.condition);
  return chips;
}

const isEmpty = (f: Filters, categoryId?: string) =>
  !f.area && f.maxPrice === "" && (!f.condition || f.condition === "ANY") && !categoryId;

interface BeeznoFiltersProps {
  value: Filters;                                   // filtros aplicados (estado da página)
  onChange: (filters: Filters) => void;
  categories?: CategoryOption[];                    // categorias raiz vindas da API
  categoryId?: string;
  onCategoryChange?: (id: string | undefined) => void;
  mobile?: boolean;
}

export default function BeeznoFilters({
  value,
  onChange,
  categories = [],
  categoryId,
  onCategoryChange,
  mobile = false,
}: BeeznoFiltersProps) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(value);
  const [draftCat, setDraftCat] = useState<string | undefined>(categoryId);

  // Se a página mudar os filtros (tag removida, tile de categoria, reset), o rascunho acompanha
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }
  const [syncedCat, setSyncedCat] = useState(categoryId);
  if (syncedCat !== categoryId) {
    setSyncedCat(categoryId);
    setDraftCat(categoryId);
  }

  const toggle = (key: string) => setOpen((prev) => (prev === key ? null : key));

  const handleSave = () => {
    onChange({ ...draft });
    onCategoryChange?.(draftCat);
    setOpen(null);
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setDraftCat(undefined);
    onChange(EMPTY_FILTERS);
    onCategoryChange?.(undefined);
    setOpen(null);
  };

  const savedChips = buildChips(value, categories.find((c) => c.id === categoryId)?.name);

  const sections = [
    {
      key: "bairro", icon: MapPin, label: "Bairro",
      content: (
        <ChipGroup
          label="Bairro"
          value={draft.area}
          onChange={(v) => setDraft({ ...draft, area: draft.area === v ? undefined : v })}
          options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))}
        />
      ),
    },
    {
      key: "estado", icon: Star, label: "Estado",
      content: (
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
      ),
    },
    ...(categories.length > 0
      ? [{
          key: "categoria", icon: Bookmark, label: "Categoria",
          content: (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={draftCat === cat.id}
                  onClick={() => setDraftCat(draftCat === cat.id ? undefined : cat.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                    draftCat === cat.id
                      ? "border-shield bg-shield-soft text-shield"
                      : "border-border-bg bg-background text-muted-foreground hover:border-shield hover:text-shield"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          ),
        }]
      : []),
    {
      key: "preco", icon: Banknote, label: "Preço",
      content: (
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Máx (Kz/dia)"
          value={draft.maxPrice}
          onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) }))}
          className={inputCls}
        />
      ),
    },
    {
      key: "datas", icon: Calendar, label: "Datas de disponibilidade",
      content: (
        <div className="flex flex-col gap-3">
          <input type="date" disabled value="" className={inputCls} aria-label="Início do arrendamento" />
          <input type="date" disabled value="" className={inputCls} aria-label="Fim do arrendamento" />
          <p className="text-xs text-muted-foreground">Chega quando a API tiver disponibilidade.</p>
        </div>
      ),
    },
  ];

  const content = (
    <div className="rounded-sm border border-border-bg bg-card">
      {!mobile && (
        <div className="flex justify-center border-b border-border-bg px-6 py-1.5">
          <h2 className="font-light text-card-foreground">Filtros</h2>
        </div>
      )}

      <div className="flex flex-col gap-4 p-5">
        {/* Preferências aplicadas */}
        <div className="rounded-xl bg-accent px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-accent-foreground">As tuas preferências</h3>
            {savedChips.length > 0 && (
              <button onClick={handleClear} className="text-xs text-accent-foreground/60 transition-colors hover:text-accent-foreground">
                Limpar todos
              </button>
            )}
          </div>
          {savedChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {savedChips.map((chip) => (
                <span key={chip} className="rounded-full bg-background/60 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-accent-foreground/60">Nenhuma preferência guardada ainda.</p>
          )}
        </div>

        {/* Editar preferências */}
        <div className="rounded-lg bg-background px-5 py-4">
          <h3 className="font-bold text-foreground">Editar preferências</h3>

          {sections.map(({ key, icon: Icon, label, content: body }) => (
            <div key={key} className="border-b border-border-bg last:border-0">
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={open === key}
                className={`flex w-full cursor-pointer items-center justify-between py-4 ${mobile ? "py-3" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`text-muted-foreground ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
                  <span className={`font-semibold text-foreground ${mobile ? "text-base" : "text-sm"}`}>{label}</span>
                </div>
                <ChevronDown className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open === key ? "rotate-180" : ""} ${mobile ? "h-5 w-5" : "h-4 w-4"}`} />
              </button>
              <div className={`transition-all duration-300 ease-out ${open === key ? "max-h-96 overflow-y-auto px-1 pb-4 opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                {body}
              </div>
            </div>
          ))}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="group relative w-full cursor-pointer overflow-hidden rounded-lg bg-primary px-5 py-2.5 font-semibold text-card transition-shadow duration-300 hover:shadow-lift"
            >
              <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              <span className={`relative ${mobile ? "text-base" : "text-sm"}`}>Guardar</span>
            </button>

            {!(isEmpty(draft, draftCat) && isEmpty(value, categoryId)) && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full cursor-pointer rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!mobile) {
    // Fixo à esquerda; no telemóvel a página continua a usar o Sheet
    return (
      <aside className="fixed top-34 left-6 hidden max-h-[calc(100vh-6rem)] w-84 shrink-0 overflow-y-auto lg:block xl:right-8 min-h-screen">
        {content}
      </aside>
    );
  }
  return <div>{content}</div>;
}