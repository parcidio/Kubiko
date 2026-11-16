import { ImageResponse } from "next/og";
import { BrandLockup, C, HoneycombCorner, OG_SIZE, SITE_HOST, ogFonts } from "@/lib/og";

// Imagem de pré-visualização do site (WhatsApp, Facebook, LinkedIn, X) — mesma mensagem do hero da landing
export const alt = "Beeznoo — Precisas de equipamento? Aluga, não compres. Câmaras, som, luzes e projetores em Luanda.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: C.verde,
          backgroundImage: `linear-gradient(135deg, ${C.verdeMedio} 0%, ${C.verde} 55%, ${C.verdeNoite} 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <HoneycombCorner />
        <BrandLockup size={60} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 74, lineHeight: 1.02, color: "#FFFFFF", letterSpacing: "-0.025em" }}>
            Precisas de equipamento?
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
            <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 74, lineHeight: 1.02, color: C.salvia, letterSpacing: "-0.025em" }}>
              Aluga, não compres.
            </span>
            {/* traço âmbar desenhado por baixo, como no hero */}
            <svg width="600" height="26" viewBox="0 0 400 26" style={{ marginTop: 2 }}>
              <path d="M4 18 C 90 4, 220 2, 396 14" fill="none" stroke={C.ambar} strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "DM Sans", fontWeight: 500, fontSize: 30, color: C.salviaTint, marginTop: 18, maxWidth: 900, lineHeight: 1.3 }}>
            Câmaras, som, luzes e projetores de quem os tem parados. Pagas ao dono, na entrega.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {["Fotografia", "Vídeo", "Som", "Eventos"].map((c) => (
              <span
                key={c}
                style={{
                  fontFamily: "DM Sans",
                  fontWeight: 700,
                  fontSize: 22,
                  color: C.areia,
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: "1.5px solid rgba(250,246,239,0.28)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <span style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 26, color: C.salvia }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
