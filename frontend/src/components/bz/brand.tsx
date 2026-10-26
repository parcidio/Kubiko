import Link from "next/link";
import { Aperture, Camera, Lightbulb, Mic, Package, PartyPopper, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ dark, href = "/explorar", className }: { dark?: boolean; href?: string; className?: string }) {
  return (
    <Link href={href} aria-label="Beeznoo — início" className={cn("inline-flex shrink-0 items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dark ? "/svg/beeznoo-lockup-horizontal-branco.svg" : "/svg/beeznoo-lockup-horizontal-tinta.svg"}
        alt="Beeznoo"
        className="h-7 w-auto"
      />
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

/**
 * Ilustração de estado (vazio, sucesso, erro): favo de hexágonos com um ícone no centro.
 * tone muda as cores; o ícone recebe a cor do texto.
 */
export function HexIllustration({
  icon: Icon, tone = "areia", size = 132, className,
}: { icon: LucideIcon; tone?: "areia" | "ok" | "erro" | "ambar" | "escuro"; size?: number; className?: string }) {
  const palette = {
    areia: { a: "#F3E9D8", b: "#ECE6DA", c: "#FFFFFF", fg: "#B76E12" },
    ok: { a: "#E3F0E9", b: "#8FC0A8", c: "#FFFFFF", fg: "#1F5C42" },
    erro: { a: "#FBEAE8", b: "#F2C9C5", c: "#FFFFFF", fg: "#B3261E" },
    ambar: { a: "#FDF0DC", b: "#F0A22E", c: "#FFFFFF", fg: "#0E2A1F" },
    escuro: { a: "#163D2D", b: "#F0A22E", c: "#0E2A1F", fg: "#F0A22E" },
  }[tone];
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 132 132" className="absolute inset-0 size-full">
        <path d={hexPath(30, 40, 16)} fill={palette.a} />
        <path d={hexPath(104, 34, 12)} fill={palette.b} opacity={0.7} />
        <path d={hexPath(108, 98, 18)} fill={palette.a} />
        <path d={hexPath(24, 100, 10)} fill={palette.b} opacity={0.6} />
        <path d={hexPath(66, 66, 40)} fill={palette.c} stroke={palette.b} strokeWidth={2} />
      </svg>
      <Icon className="absolute top-1/2 left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2" style={{ color: palette.fg }} strokeWidth={1.6} />
    </div>
  );
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
