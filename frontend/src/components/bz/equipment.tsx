import Link from "next/link";
import { BadgeCheck, MapPin, Package, type LucideIcon } from "lucide-react";
import { hexPath } from "./brand";
import { Kz } from "./ui";
import { initials } from "@/lib/booking";
import { CONDITION_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemCondition, ItemSummary } from "@/lib/types";

/** Foto 4:3; sem foto → bloco areia-2 com o ícone da categoria. */
export function ItemPhoto({
  src, alt, icon, className, rounded = true,
}: { src?: string | null; alt: string; icon?: LucideIcon; className?: string; rounded?: boolean }) {
  const Icon = icon ?? Package;
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-areia-2", rounded && "rounded-cartao", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-mel" role="img" aria-label={`${alt} — sem foto`}>
          <Icon className="size-1/4 max-h-12 max-w-12" strokeWidth={1.4} aria-hidden />
        </div>
      )}
    </div>
  );
}

const CONDITION_LEVEL: Record<ItemCondition, number> = { NEW: 5, LIKE_NEW: 4, GOOD: 3, FAIR: 2 };

/** Estado do equipamento em 5 hexágonos (motivo da marca). */
export function ConditionMeter({ condition, className }: { condition: ItemCondition; className?: string }) {
  const level = CONDITION_LEVEL[condition] ?? 3;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg viewBox="0 0 110 22" className="h-5 w-[110px]" role="img" aria-label={`Estado: ${CONDITION_LABEL[condition]} (${level} de 5)`}>
        {Array.from({ length: 5 }, (_, i) => (
          <path key={i} d={hexPath(11 + i * 22, 11, 10)} fill={i < level ? "#1F5C42" : "#ECE6DA"} />
        ))}
      </svg>
      <span className="text-sm font-medium text-verde">{CONDITION_LABEL[condition] ?? condition}</span>
    </div>
  );
}

export function VerifiedBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-salvia-tint px-2.5 py-1 text-[13px] font-bold text-verde-medio", className)}>
      <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />
      {compact ? <span className="sr-only">Verificado</span> : "Verificado"}
    </span>
  );
}

export function Avatar({ name, size = "md", className }: { name?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-verde font-titulo font-bold text-ambar",
        size === "sm" && "size-9 text-sm",
        size === "md" && "size-11 text-base",
        size === "lg" && "size-14 text-lg",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function placeOf(item: { city?: string | null; province?: string | null }) {
  return [item.city, item.province].filter(Boolean).join(", ") || "Luanda";
}

/** Cartão de equipamento: foto domina, preço flutua por cima. */
export function EquipmentCard({ item, href, icon, index = 0 }: { item: ItemSummary; href: string; icon?: LucideIcon; index?: number }) {
  return (
    <Link
      href={href}
      className="group block animate-sobe rounded-cartao outline-none focus-visible:ring-4 focus-visible:ring-verde-medio/30"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative">
        <ItemPhoto src={item.coverPhoto} alt={item.title} icon={icon} className="transition duration-300 group-hover:brightness-95" />
        <span className="absolute bottom-2 left-2 rounded-full bg-branco/95 px-3 py-1 text-verde shadow-flutua backdrop-blur">
          <Kz value={item.pricePerDay} className="text-[15px]" />
          <span className="text-xs text-cinza"> /dia</span>
        </span>
      </div>
      <div className="grid gap-1 px-1 pt-2.5">
        <h3 className="line-clamp-2 font-titulo text-base leading-snug font-bold text-verde group-hover:underline md:text-[17px]">{item.title}</h3>
        <p className="flex items-center gap-1 text-[13px] text-cinza">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
          <span className="truncate">{placeOf(item)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{CONDITION_LABEL[item.condition] ?? item.condition}</span>
        </p>
      </div>
    </Link>
  );
}

/** Mosaico de categoria no Explorar. */
export function CategoryTile({
  label, icon: Icon, active, onClick, tone,
}: { label: string; icon: LucideIcon; active: boolean; onClick: () => void; tone: number }) {
  const tones = ["bg-ambar-tint", "bg-salvia-tint", "bg-areia-2", "bg-[#F6E3D3]", "bg-[#E6EEF0]", "bg-[#EFE8F3]"];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-24 w-24 shrink-0 flex-col items-start justify-between rounded-cartao p-3 text-left transition active:scale-[.97] md:h-28 md:w-auto",
        active ? "bg-verde text-areia" : cn(tones[tone % tones.length], "text-verde hover:brightness-[.97]"),
      )}
    >
      <Icon className={cn("size-6", active ? "text-ambar" : "text-mel")} strokeWidth={1.8} aria-hidden />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}
