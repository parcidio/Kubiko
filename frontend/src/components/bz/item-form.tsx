"use client";

import { MoneyField, SelectField, TextArea, TextField, ChipGroup } from "./form";
import { categoryIcon } from "./brand";
import { formatKz, LUANDA_AREAS, suggestedDeposit } from "@/lib/format";
import type { Category, Item, ItemCondition } from "@/lib/types";
import type { ItemInput } from "@/lib/api";
import { docT } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

export interface ItemDraft {
  title: string;
  description: string;
  categoryId: string;
  condition: ItemCondition;
  city: string;
  pricePerDay: number | "";
  weeklyDiscount: string;
  declaredValue: number | "";
  depositAmount: number | "";
}

export const EMPTY_DRAFT: ItemDraft = {
  title: "", description: "", categoryId: "", condition: "LIKE_NEW", city: "", pricePerDay: "", weeklyDiscount: "0", declaredValue: "", depositAmount: "",
};

export function draftFromItem(item: Item): ItemDraft {
  return {
    ...EMPTY_DRAFT,
    title: item.title,
    description: item.description ?? "",
    categoryId: item.category?.id ?? "",
    condition: item.condition,
    city: item.city ?? "",
    pricePerDay: Number(item.pricePerDay),
    depositAmount: item.depositAmount ? Number(item.depositAmount) : "",
  };
}

export function draftToInput(d: ItemDraft): ItemInput {
  return {
    title: d.title.trim(),
    description: d.description.trim() || undefined,
    categoryId: d.categoryId,
    itemCondition: d.condition,
    pricePerDay: Number(d.pricePerDay),
    depositAmount: d.depositAmount === "" ? undefined : Number(d.depositAmount),
    province: "Luanda",
    city: d.city || undefined,
  };
}

export type DraftErrors = Partial<Record<keyof ItemDraft, string>>;

export function validateDetails(d: ItemDraft): DraftErrors {
  const t = docT().itemForm;
  const e: DraftErrors = {};
  if (d.title.trim().length < 4) e.title = t.errTitle;
  if (!d.categoryId) e.categoryId = t.errCategory;
  if (!d.city) e.city = t.errCity;
  return e;
}

export function validatePrice(d: ItemDraft): DraftErrors {
  const t = docT().itemForm;
  const e: DraftErrors = {};
  if (!d.pricePerDay || d.pricePerDay < 1000) e.pricePerDay = t.errPrice;
  if (d.depositAmount === "" || d.depositAmount < 1) e.depositAmount = t.errDeposit;
  return e;
}

const CONDITIONS: ItemCondition[] = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];

type Props = { draft: ItemDraft; set: (patch: Partial<ItemDraft>) => void; errors: DraftErrors; categories?: Category[] };

export function DetailsFields({ draft, set, errors, categories = [] }: Props) {
  const dict = useT();
  const t = dict.itemForm;
  return (
    <div className="grid gap-5 rounded-cartao border border-borda bg-branco p-4 md:p-5">
      <TextField label={t.name} value={draft.title} onChange={(title) => set({ title })} error={errors.title} placeholder={t.namePlaceholder} maxLength={200} />
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">{t.category}</p>
        <ChipGroup
          label={t.category}
          value={draft.categoryId || undefined}
          onChange={(categoryId) => set({ categoryId })}
          options={categories.filter((c) => !c.parentId).map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c.slug) }))}
        />
        {errors.categoryId && <p className="text-[13px] font-medium text-erro">{errors.categoryId}</p>}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">{t.condition}</p>
        <ChipGroup label={t.condition} value={draft.condition} onChange={(condition) => set({ condition })} options={CONDITIONS.map((value) => ({ value, label: dict.condition[value] }))} />
      </div>
      <SelectField label={t.area} value={draft.city} onChange={(city) => set({ city })} placeholder={t.areaPlaceholder} options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))} error={errors.city} />
      <TextArea
        label={t.description}
        value={draft.description}
        onChange={(description) => set({ description })}
        rows={5}
        maxLength={2000}
        placeholder={t.descriptionPlaceholder}
        hint={t.descriptionHint}
      />
    </div>
  );
}

export function PriceFields({ draft, set, errors }: Omit<Props, "categories">) {
  const t = useT().itemForm;
  const price = draft.pricePerDay || 0;
  const discount = Number(draft.weeklyDiscount);
  const suggestion = suggestedDeposit(Number(draft.declaredValue || 0), Number(price));
  return (
    <div className="grid gap-5 rounded-cartao border border-borda bg-branco p-4 md:p-5">
      <MoneyField label={t.pricePerDay} value={draft.pricePerDay} onChange={(pricePerDay) => set({ pricePerDay })} error={errors.pricePerDay} />
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">{t.weekDiscount}</p>
        <ChipGroup
          label={t.weekDiscountLabel}
          value={draft.weeklyDiscount}
          onChange={(weeklyDiscount) => set({ weeklyDiscount })}
          options={["0", "10", "15", "20"].map((v) => ({ value: v, label: v === "0" ? t.noDiscount : `−${v}%` }))}
        />
        {price > 0 && (
          <p className="text-[13px] text-cinza">
            {t.sevenDays} <strong className="num text-verde">{formatKz(price * 7 * (1 - discount / 100))}</strong>
            {discount > 0 && t.discountNotApplied}
          </p>
        )}
      </div>
      <MoneyField
        label={t.value}
        value={draft.declaredValue}
        onChange={(declaredValue) => set({ declaredValue })}
        hint={t.valueHint}
      />
      <MoneyField
        label={t.deposit}
        value={draft.depositAmount}
        onChange={(depositAmount) => set({ depositAmount })}
        error={errors.depositAmount}
        hint={suggestion ? <>{t.suggestion} <button type="button" className="font-bold text-mel-texto underline" onClick={() => set({ depositAmount: suggestion })}>{formatKz(suggestion)}</button>{t.suggestionRule}</> : t.depositHint}
      />
    </div>
  );
}
