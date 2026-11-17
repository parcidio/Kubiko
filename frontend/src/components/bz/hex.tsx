import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Polígono do hexágono de vértice para cima (motivo da marca), para `clip-path`. */
export const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

export type HexTone = "verde" | "salvia" | "areia" | "salvia-tint" | "ambar-tint" | "erro";

const HEX_TONE: Record<HexTone, string> = {
  verde: "bg-verde-solido text-ambar", // ícone âmbar sobre verde (passos, confiança); continua verde no tema escuro
  salvia: "bg-salvia text-verde", // ícone verde sobre sálvia
  areia: "bg-areia-2 text-mel", // estados vazios
  "salvia-tint": "bg-salvia-tint text-verde-medio", // positivo
  "ambar-tint": "bg-ambar-tint text-aviso-texto", // prazo/aviso
  erro: "bg-erro-tint text-erro", // erro
};

/**
 * HexTile (v4): ícone (ou número) dentro de um hexágono recortado por `clip-path`.
 * `size` é a largura em px (40–56 nos passos; maior em estados vazios); a altura segue a proporção do hexágono.
 * `flip` vira o hexágono 180° no hover do tile ou de um antepassado `.group` (só com rato; reduced-motion desliga).
 * Decorativo por omissão; passa `label` quando o hexágono sozinho comunica algo.
 */
export function HexTile({
  icon: Icon, tone = "verde", size = 48, flip, label, className, children,
}: {
  icon?: LucideIcon;
  tone?: HexTone;
  size?: number;
  flip?: boolean;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-titulo font-bold [transform-style:preserve-3d]",
        HEX_TONE[tone],
        flip && "hex-vira",
        className,
      )}
      style={{ width: size, height: Math.round(size * 1.1547), clipPath: HEX_CLIP, fontSize: Math.round(size * 0.36) }}
    >
      <span className="flex items-center justify-center">
        {Icon ? <Icon style={{ width: size * 0.44, height: size * 0.44 }} strokeWidth={1.8} aria-hidden /> : children}
      </span>
    </span>
  );
}
