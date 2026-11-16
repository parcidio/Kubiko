import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Peças partilhadas das imagens de pré-visualização (Open Graph: WhatsApp, Facebook, LinkedIn, X).
 * 1200×630, PNG gerado no servidor com next/og (Satori: só flexbox, fontes ttf). Cores da Identidade Verde v4.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export const C = {
  verde: "#0E2A1F",
  verdeNoite: "#081A13",
  verdeMedio: "#1F5C42",
  areia: "#FAF6EF",
  areia2: "#F3E9D8",
  ambar: "#F0A22E",
  salvia: "#8FC0A8",
  salviaTint: "#E3F0E9",
};

/** URL público do site (metadataBase e textos). Gravado no build: SITE_URL, senão beeznoo.ao. */
export const SITE_URL = (process.env.SITE_URL || "https://beeznoo.ao").replace(/\/$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

const fontsDir = join(process.cwd(), "public/fonts");
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: "normal" }[]> | null = null;

/** Bricolage (títulos) e DM Sans (texto), lidas uma vez por processo. */
export function ogFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(fontsDir, "BricolageGrotesque-ExtraBold.ttf")),
    readFile(join(fontsDir, "BricolageGrotesque-Bold.ttf")),
    readFile(join(fontsDir, "DMSans-Medium.ttf")),
    readFile(join(fontsDir, "DMSans-Bold.ttf")),
  ]).then(([b800, b700, d500, d700]) => [
    { name: "Bricolage", data: b800, weight: 800, style: "normal" },
    { name: "Bricolage", data: b700, weight: 700, style: "normal" },
    { name: "DM Sans", data: d500, weight: 500, style: "normal" },
    { name: "DM Sans", data: d700, weight: 700, style: "normal" },
  ]);
  return fontsPromise;
}

/** Símbolo da marca (DESIGN_SYSTEM §5): hexágono âmbar com três faixas verdes. */
export function BrandHex({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <polygon points="256,34 450,147 450,371 256,478 62,371 62,147" fill={C.ambar} />
      <rect x="62" y="161" width="388" height="42" fill={C.verde} />
      <rect x="62" y="238" width="388" height="42" fill={C.verde} />
      <rect x="62" y="315" width="388" height="42" fill={C.verde} />
    </svg>
  );
}

/** Logótipo: símbolo + "beeznoo" em Bricolage 800 minúsculas, sobre fundo escuro. */
export function BrandLockup({ size = 56 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.32 }}>
      <BrandHex size={size} />
      <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: size * 0.82, color: C.areia, letterSpacing: "-0.02em" }}>
        beeznoo
      </span>
    </div>
  );
}

/** Colmeia decorativa (contornos de hexágono) no canto do cartão. */
export function HoneycombCorner() {
  const hex = (cx: number, cy: number, r: number) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return pts;
  };
  const cells: [number, number][] = [
    [470, 60], [540, 100], [470, 140], [540, 180], [610, 140], [610, 60], [400, 100], [540, 20], [680, 100], [610, 220],
  ];
  return (
    <svg width="760" height="320" viewBox="0 0 760 320" style={{ position: "absolute", top: -20, right: -120 }}>
      {cells.map(([x, y], i) => (
        <polygon key={i} points={hex(x, y, 44)} fill="none" stroke={C.ambar} strokeOpacity={i % 3 === 0 ? 0.28 : 0.12} strokeWidth={2} />
      ))}
    </svg>
  );
}

/** "35.000 Kz" (Kz inteiros, ponto de milhares). */
export function kz(v: number) {
  return `${Math.round(v).toLocaleString("de-DE")} Kz`;
}
