"use client";

import { useState } from "react";
import { Banknote, Bookmark, Calendar, ChevronDown, MapPin, Star } from "lucide-react";
import { ChipGroup, inputClass } from "@/components/bz/form";
import { Button } from "@/components/bz/ui";
import { cn } from "@/lib/utils";
import { LUANDA_AREAS, addDaysIso, formatRange, todayIso } from "@/lib/format";
import { fmt, type Dict, type Lang } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import type { ItemCondition } from "@/lib/types";

// Mesmo contrato do backend; a página importa daqui
export type Filters = {
  area?: string;
  maxPrice: number | "";
  condition?: ItemCondition | "ANY";
  pesquisa?: string;
  categorias?: string[];
  precoMin?: number | "";
  precoMax?: number | "";
  dataInicio?: string;
  dataFim?: string;
};
export const EMPTY_FILTERS: Filters = { maxPrice: "", categorias: [], precoMin: "", precoMax: "" };

type CategoryOption = { id: string; name: string };

// Campos v4 (raio 12, contorno borda-forte, foco verde-médio): os mesmos do resto da app
const inputCls = cn(inputClass, "disabled:cursor-not-allowed");

function buildChips(f: Filters, t: Dict, lang: Lang, categoryName?: string): string[] {
  const chips: string[] = [];
  if (categoryName) chips.push(categoryName);
  if (f.area) chips.push(f.area);
  if (f.maxPrice !== "") chips.push(fmt(t.explore.upTo, { price: f.maxPrice.toLocaleString("de-DE") }));
  if (f.condition && f.condition !== "ANY") chips.push(t.condition[f.condition] ?? f.condition);
  if (f.dataInicio && f.dataFim) chips.push(fmt(t.explore.freeOn, { range: formatRange(f.dataInicio, f.dataFim, lang) }));
  return chips;
}

const isEmpty = (f: Filters, categoryId?: string) =>
  !f.area && f.maxPrice === "" && (!f.condition || f.condition === "ANY") && !categoryId && !f.dataInicio;

interface BeeznoFiltersProps {
  value?: Filters;                                  // filtros aplicados (estado da página)
  onChange?: (filters: Filters) => void;
  initialFilters?: Filters;                         // compatibilidade com a rota antiga /items
  onSave?: (filters: Filters) => void;
  categories?: CategoryOption[];                    // categorias raiz vindas da API
  categoryId?: string;
  onCategoryChange?: (id: string | undefined) => void;
  mobile?: boolean;
  /** Depois de "Guardar" ou "Limpar" (o Explorar fecha o Sheet no telemóvel) */
  onApplied?: () => void;
}

export default function BeeznoFilters({
  value,
  onChange,
  initialFilters,
  onSave,
  categories = [],
  categoryId,
  onCategoryChange,
  mobile = false,
  onApplied,
}: BeeznoFiltersProps) {
  const applied = value ?? initialFilters ?? EMPTY_FILTERS;
  const dict = useT();
  const lang = useLang();
  const t = dict.filters;
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(applied);
  const [draftCat, setDraftCat] = useState<string | undefined>(categoryId);

  // Se a página mudar os filtros (tag removida, tile de categoria, reset), o rascunho acompanha
  const [syncedValue, setSyncedValue] = useState(applied);
  if (syncedValue !== applied) {
    setSyncedValue(applied);
    setDraft(applied);
  }
  const [syncedCat, setSyncedCat] = useState(categoryId);
  if (syncedCat !== categoryId) {
    setSyncedCat(categoryId);
    setDraftCat(categoryId);
  }

  const toggle = (key: string) => setOpen((prev) => (prev === key ? null : key));

  const handleSave = () => {
    onChange?.({ ...draft });
    onSave?.({ ...draft });
    onCategoryChange?.(draftCat);
    setOpen(null);
    onApplied?.();
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setDraftCat(undefined);
    onChange?.(EMPTY_FILTERS);
    onSave?.(EMPTY_FILTERS);
    onCategoryChange?.(undefined);
    setOpen(null);
    onApplied?.();
  };

  const savedChips = buildChips(applied, dict, lang, categories.find((c) => c.id === categoryId)?.name);

  const sections = [
    {
      key: "bairro", icon: MapPin, label: t.area,
      content: (
        <ChipGroup
          label={t.area}
          value={draft.area}
          onChange={(v) => setDraft({ ...draft, area: draft.area === v ? undefined : v })}
          options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))}
        />
      ),
    },
    {
      key: "estado", icon: Star, label: t.condition,
      content: (
        <ChipGroup<ItemCondition | "ANY">
          label={t.condition}
          value={draft.condition ?? "ANY"}
          onChange={(v) => setDraft({ ...draft, condition: v })}
          options={[
            { value: "ANY", label: t.any },
            { value: "NEW", label: dict.condition.NEW },
            { value: "LIKE_NEW", label: dict.condition.LIKE_NEW },
          ]}
        />
      ),
    },
    ...(categories.length > 0
      ? [{
          key: "categoria", icon: Bookmark, label: t.category,
          content: (
            <ChipGroup
              label={t.category}
              value={draftCat}
              onChange={(v) => setDraftCat(draftCat === v ? undefined : v)}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            />
          ),
        }]
      : []),
    {
      key: "preco", icon: Banknote, label: t.price,
      content: (
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={t.pricePh}
          value={draft.maxPrice}
          onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) }))}
          className={inputCls}
        />
      ),
    },
    {
      key: "datas", icon: Calendar, label: t.dates,
      content: (
        <div className="flex flex-col gap-3">
          <label className="grid gap-1.5 text-sm font-medium text-verde">
            {t.pickup}
            <input
              type="date"
              min={todayIso()}
              value={draft.dataInicio ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((p) => ({ ...p, dataInicio: v || undefined, dataFim: v && (!p.dataFim || p.dataFim <= v) ? addDaysIso(v, 1) : v ? p.dataFim : undefined }));
              }}
              className={inputCls}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-verde">
            {t.dropoff}
            <input
              type="date"
              min={draft.dataInicio ? addDaysIso(draft.dataInicio, 1) : todayIso(1)}
              disabled={!draft.dataInicio}
              value={draft.dataFim ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, dataFim: e.target.value || undefined }))}
              className={inputCls}
            />
          </label>
          <p className="text-[13px] text-cinza">{t.datesHint}</p>
        </div>
      ),
    },
  ];

  const content = (
    <div className={cn("overflow-y-auto overscroll-contain", !mobile && "max-h-[calc(100dvh-6rem)] rounded-cartao border border-borda bg-branco")}>
      {!mobile && (
        <div className="border-b border-borda px-5 py-4">
          <h2 className="font-titulo text-lg font-bold tracking-tight text-verde">{t.title}</h2>
        </div>
      )}

      <div className={cn("flex flex-col gap-4", !mobile && "p-5")}>
        {/* Preferências aplicadas */}
        <div className="rounded-cartao bg-areia-2 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-verde">{t.yours}</h3>
            {savedChips.length > 0 && (
              <button type="button" onClick={handleClear} className="-my-2 min-h-11 cursor-pointer text-sm font-medium text-mel-texto hover:underline">
                {t.clearAll}
              </button>
            )}
          </div>
          {savedChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {savedChips.map((chip) => (
                <span key={chip} className="inline-flex min-h-8 items-center rounded-full bg-branco px-3 text-[13px] font-medium text-verde">
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-cinza">{t.none}</p>
          )}
        </div>

        {/* Editar preferências */}
        <div>
          {sections.map(({ key, icon: Icon, label, content: body }) => (
            <div key={key} className="border-b border-borda last:border-0">
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={open === key}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-5 text-mel" strokeWidth={1.8} aria-hidden />
                  <span className="text-[15px] font-bold text-verde">{label}</span>
                </span>
                <ChevronDown
                  className={cn("size-5 shrink-0 text-cinza transition-transform duration-200 ease-out", open === key && "rotate-180")}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </button>
              {open === key && <div className="animate-sobe px-0.5 pb-4">{body}</div>}
            </div>
          ))}

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="dark" block onClick={handleSave}>
              {t.save}
            </Button>
            {!(isEmpty(draft, draftCat) && isEmpty(applied, categoryId)) && (
              <Button variant="ghost" block onClick={handleClear}>
                {t.clearAllFilters}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!mobile) {
    // Fixo à esquerda; no telemóvel a página continua a usar o Sheet
    return (
      <aside aria-label={t.title} className="sticky top-20 hidden w-84 shrink-0 self-start lg:block">
        {content}
      </aside>
    );
  }
  return <div>{content}</div>;
}