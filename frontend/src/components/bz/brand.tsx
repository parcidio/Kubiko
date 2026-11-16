import Link from "next/link";
import { Aperture, Camera, Lightbulb, Mic, Package, PartyPopper, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logótipo horizontal (imagem SVG em public/svg; símbolo vetorial v4 em public/png/beeznoo-icon.svg).
 * `dark` = sobre fundo escuro (sempre branco). Sem `dark`: tinta no tema claro, branco no tema escuro.
 */
export function Logo({ dark, href = "/explorar", className }: { dark?: boolean; href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Beeznoo — início" className={cn("inline-flex shrink-0 items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dark ? "/svg/beeznoo-lockup-horizontal-branco.svg" : "/svg/beeznoo-lockup-horizontal-tinta.svg"}
        alt="Beeznoo"
        className={cn("h-7 w-auto", !dark && "dark:hidden")}
      />
      {!dark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/svg/beeznoo-lockup-horizontal-branco.svg" alt="" aria-hidden className="hidden h-7 w-auto dark:block" />
      )}
    </Link>
  );
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  fotografia: Camera,
  video: Video,
  audio: Mic,
  iluminacao: Lightbulb,
  eventos: PartyPopper,
  lentes: Aperture,
};

export function categoryIcon(slug?: string | null): LucideIcon {
  return (slug && CATEGORY_ICON[slug]) || Package;
}

/** Hexágono "pontudo em cima" — o motivo da marca. */
export function hexPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

/** Padrão de colmeia para pôr por trás de heróis escuros. */
export function HexGlow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="hex-bg absolute inset-0" />
      <div className="absolute -top-24 -right-16 size-64 rounded-full bg-ambar/25 blur-3xl" />
      <div className="absolute -bottom-28 -left-20 size-64 rounded-full bg-verde-medio/50 blur-3xl" />
    </div>
  );
}
