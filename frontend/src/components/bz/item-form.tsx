"use client";

import { MoneyField, SelectField, TextArea, TextField, ChipGroup } from "./form";
import { categoryIcon } from "./brand";
import { formatKz, LUANDA_AREAS, suggestedDeposit } from "@/lib/format";
import type { Category, Item, ItemCondition } from "@/lib/types";
import type { ItemInput } from "@/lib/api";

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
  const e: DraftErrors = {};
  if (d.title.trim().length < 4) e.title = "Dá um nome com marca e modelo (ex.: Sony A7 III).";
  if (!d.categoryId) e.categoryId = "Escolhe a categoria.";
  if (!d.city) e.city = "Escolhe o bairro.";
  return e;
}

export function validatePrice(d: ItemDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.pricePerDay || d.pricePerDay < 1000) e.pricePerDay = "O preço por dia tem de ser pelo menos 1.000 Kz.";
  if (d.depositAmount === "" || d.depositAmount < 1) e.depositAmount = "Define a caução.";
  return e;
}

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: "NEW", label: "Novo" },
  { value: "LIKE_NEW", label: "Como novo" },
  { value: "GOOD", label: "Bom estado" },
  { value: "FAIR", label: "Sinais de uso" },
];

type Props = { draft: ItemDraft; set: (patch: Partial<ItemDraft>) => void; errors: DraftErrors; categories?: Category[] };

export function DetailsFields({ draft, set, errors, categories = [] }: Props) {
  return (
    <div className="grid gap-5">
      <TextField label="Nome do equipamento" value={draft.title} onChange={(title) => set({ title })} error={errors.title} placeholder="Ex.: Sony A7 III com lente 28-70mm" maxLength={200} />
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">Categoria</p>
        <ChipGroup
          label="Categoria"
          value={draft.categoryId || undefined}
          onChange={(categoryId) => set({ categoryId })}
          options={categories.filter((c) => !c.parentId).map((c) => ({ value: c.id, label: c.name, icon: categoryIcon(c.slug) }))}
        />
        {errors.categoryId && <p className="text-[13px] font-medium text-erro">{errors.categoryId}</p>}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">Estado</p>
        <ChipGroup label="Estado" value={draft.condition} onChange={(condition) => set({ condition })} options={CONDITIONS} />
      </div>
      <SelectField label="Bairro onde está" value={draft.city} onChange={(city) => set({ city })} placeholder="Escolhe o bairro" options={LUANDA_AREAS.map((a) => ({ value: a, label: a }))} error={errors.city} />
      <TextArea
        label="Descrição"
        value={draft.description}
        onChange={(description) => set({ description })}
        rows={5}
        maxLength={2000}
        placeholder={"O que vem incluído (baterias, cartões, mala), para que serve melhor, cuidados."}
        hint="Diz o que vem incluído. Evita surpresas na entrega."
      />
    </div>
  );
}

export function PriceFields({ draft, set, errors }: Omit<Props, "categories">) {
  const price = draft.pricePerDay || 0;
  const discount = Number(draft.weeklyDiscount);
  const suggestion = suggestedDeposit(Number(draft.declaredValue || 0), Number(price));
  return (
    <div className="grid gap-5">
      <MoneyField label="Preço por dia" value={draft.pricePerDay} onChange={(pricePerDay) => set({ pricePerDay })} error={errors.pricePerDay} />
      <div className="grid gap-2">
        <p className="text-sm font-medium text-verde">Desconto para uma semana</p>
        <ChipGroup
          label="Desconto semanal"
          value={draft.weeklyDiscount}
          onChange={(weeklyDiscount) => set({ weeklyDiscount })}
          options={["0", "10", "15", "20"].map((v) => ({ value: v, label: v === "0" ? "Sem desconto" : `−${v}%` }))}
        />
        {price > 0 && (
          <p className="text-[13px] text-cinza">
            7 dias = <strong className="text-verde">{formatKz(price * 7 * (1 - discount / 100))}</strong>
            {discount > 0 && " (ainda não é aplicado pela API)"}
          </p>
        )}
      </div>
      <MoneyField
        label="Quanto vale o equipamento?"
        value={draft.declaredValue}
        onChange={(declaredValue) => set({ declaredValue })}
        hint="Valor de compra aproximado. Serve para calcular a caução."
      />
      <MoneyField
        label="Caução"
        value={draft.depositAmount}
        onChange={(depositAmount) => set({ depositAmount })}
        error={errors.depositAmount}
        hint={suggestion ? <>Sugestão: <button type="button" className="font-bold text-mel-texto underline" onClick={() => set({ depositAmount: suggestion })}>{formatKz(suggestion)}</button> (o menor entre 10% do valor e 3 diárias).</> : "Retida durante o aluguer e devolvida se tudo correr bem."}
      />
    </div>
  );
}
