import Link from "next/link";
import { BadgeCheck, MapPin, Package, Repeat2, Sparkles, Star, type LucideIcon } from "lucide-react";
import { categoryIcon, hexPath } from "./brand";
import { Kz } from "./ui";
import { initials } from "@/lib/booking";
import { CONDITION_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemCondition, ItemSummary } from "@/lib/types";

/** Foto 4:3; sem foto → bloco areia-2 com o ícone da categoria. */
export function ItemPhoto({
  src, alt, icon, className, imgClassName, rounded = true,
}: { src?: string | null; alt: string; icon?: LucideIcon; className?: string; imgClassName?: string; rounded?: boolean }) {
  const Icon = icon ?? Package;
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-areia-2", rounded && "rounded-cartao", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("size-full object-cover", imgClassName)} />
      ) : (
        <div className={cn("flex size-full items-center justify-center text-mel", imgClassName)} role="img" aria-label={`${alt} — sem foto`}>
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

/** 4,8 — vírgula decimal (pt-PT). */
export function formatRating(value: number) {
  return value.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Cinco estrelas preenchidas até à média arredondada a meia estrela. */
export function Stars({ value, size = "md", className }: { value: number; size?: "sm" | "md"; className?: string }) {
  const half = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${formatRating(value)} de 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = half >= i + 1 ? 1 : half >= i + 0.5 ? 0.5 : 0;
        return (
          <span key={i} className={cn("relative", size === "sm" ? "size-3.5" : "size-5")} aria-hidden>
            <Star className="absolute inset-0 size-full text-borda-forte" strokeWidth={1.8} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn("fill-ambar text-ambar", size === "sm" ? "size-3.5" : "size-5")} strokeWidth={1.8} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** "4,8 (12)" com estrela, ou "Novo na Beeznoo" quando ainda não há avaliações. */
export function RatingInline({ average, count, className }: { average: number | null; count: number; className?: string }) {
  if (!average || count === 0) {
    return <span className={cn("text-[13px] font-medium text-mel-texto", className)}>Novo na Beeznoo</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] text-cinza", className)}>
      <Star className="size-3.5 fill-ambar text-ambar" strokeWidth={1.8} aria-hidden />
      <span className="num font-bold text-verde">{formatRating(average)}</span>
      <span className="num">({count})</span>
      <span className="sr-only">{count === 1 ? "avaliação" : "avaliações"}</span>
    </span>
  );
}

/** Cartão de equipamento: foto domina, preço flutua por cima, prova social por baixo. */
export function EquipmentCard({
  item, href, icon, index = 0, className, showFeatured = true,
}: { item: ItemSummary; href: string; icon?: LucideIcon; index?: number; className?: string; showFeatured?: boolean }) {
  const tag = item.featured && showFeatured
    ? { label: "Em destaque", icon: Sparkles, cls: "bg-verde text-ambar" }
    : null;
  return (
    <Link
      href={href}
      className={cn(
        "group block animate-sobe rounded-cartao outline-none transition active:scale-[.98] focus-visible:ring-4 focus-visible:ring-verde-medio/30",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative overflow-hidden rounded-cartao">
        <ItemPhoto
          src={item.coverPhoto}
          alt={item.title}
          icon={icon ?? categoryIcon(item.categorySlug)}
          imgClassName="transition duration-500 ease-out group-hover:scale-105"
        />
        {tag && (
          <span className={cn("absolute top-2 left-2 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold", tag.cls)}>
            {tag.icon && <tag.icon className="size-3.5" strokeWidth={2} aria-hidden />}
            {tag.label}
          </span>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-branco/95 px-3 py-1 text-verde shadow-flutua backdrop-blur">
          <Kz value={item.pricePerDay} className="text-[15px]" />
          <span className="text-xs text-cinza"> /dia</span>
        </span>
      </div>
      <div className="grid gap-1 px-1 pt-2">
        <h3 className="line-clamp-2 font-titulo text-base leading-snug font-bold text-verde group-hover:underline md:text-[17px]">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <RatingInline average={item.ratingAverage} count={item.ratingCount} />
          {item.completedRentals > 0 && (
            <span className="inline-flex items-center gap-1 text-[13px] text-cinza">
              <Repeat2 className="size-3.5" strokeWidth={1.8} aria-hidden />
              <span className="num">
                {item.completedRentals} {item.completedRentals === 1 ? "aluguer" : "alugueres"}
              </span>
            </span>
          )}
        </div>
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
