import Link from "next/link";
import { Aperture, Camera, Lightbulb, Mic, Package, PartyPopper, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logótipo horizontal (imagem SVG em public/svg; símbolo vetorial v4 em public/png/beeznoo-icon.svg).
 * `dark` = sobre fundo escuro (sempre branco). Sem `dark`: tinta no tema claro, branco no tema escuro.
 */
// label: "Beeznoo — início" / "Beeznoo — home" (t.common.homeLabel); brand.tsx não usa hooks para servir server components
export function Logo({ dark, href = "/explorar", className, label = "Beeznoo" }: { dark?: boolean; href?: string; className?: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex min-h-11 shrink-0 items-center", className)}>
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
      {/* brilhos em radial-gradient e não filter: blur (um blur de 64px repinta a cada scroll num Android de gama média) */}
      <div className="absolute -top-40 -right-36 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(240_162_46/0.22),transparent)]" />
      <div className="absolute -bottom-44 -left-40 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(31_92_66/0.45),transparent)]" />
    </div>
  );
}
