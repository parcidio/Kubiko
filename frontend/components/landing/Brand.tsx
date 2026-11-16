import type { CSSProperties } from "react";

/** Símbolo Beeznoo (DESIGN_SYSTEM §5): hexágono âmbar com três faixas verdes. */
export function BeeznooMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <polygon points="256,34 450,147 450,371 256,478 62,371 62,147" fill="#F0A22E" />
      <rect x="62" y="161" width="388" height="42" fill="#0E2A1F" />
      <rect x="62" y="238" width="388" height="42" fill="#0E2A1F" />
      <rect x="62" y="315" width="388" height="42" fill="#0E2A1F" />
    </svg>
  );
}

/** Hexágono 3D decorativo: 5 camadas com translateZ e brilho decrescente (DESIGN_SYSTEM §6–7). */
export function Hex3D({
  tone,
  size,
  duration,
  z = 0,
  className = "",
  style,
}: {
  tone: "a" | "b" | "c" | "d";
  size: number;
  duration: number;
  z?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`lp-hx lp-hx--${tone} ${className}`}
      style={{ "--s": `${size}px`, "--d": `${duration}s`, "--z": `${z}px`, ...style } as CSSProperties}
    >
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

/** Padrão de colmeia em fundo escuro. */
export function HexGrid({ id, faint = false }: { id: string; faint?: boolean }) {
  return (
    <svg className={`lp-hexgrid${faint ? " lp-hexgrid--faint" : ""}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="104" height="60" patternUnits="userSpaceOnUse">
          <path
            d="M26 0l26 15v30L26 60 0 45V15zM78 -30l26 15v30L78 30 52 15v-30zM78 30l26 15v30L78 90 52 75V45z"
            fill="none"
            stroke="#8FC0A8"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
