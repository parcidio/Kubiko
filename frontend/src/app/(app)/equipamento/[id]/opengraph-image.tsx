import { ImageResponse } from "next/og";
import { getPublicItem, placeOf } from "@/lib/item-server";
import { BrandLockup, C, OG_SIZE, SITE_HOST, kz, ogFonts } from "@/lib/og";

// Pré-visualização de um equipamento: foto à esquerda, nome, preço por dia e bairro à direita
export const alt = "Equipamento para alugar na Beeznoo";
export const size = OG_SIZE;
// JPEG: com a foto, um PNG passa dos 600 KB e o WhatsApp deixa de mostrar a imagem
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getPublicItem(id);
  const fonts = await ogFonts();
  const cover = item?.photos?.slice().sort((a, b) => a.position - b.position)[0]?.photUrl;
  const photo = cover ? await loadImage(cover) : null;

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: C.verde, position: "relative" }}>
        {/* foto (ou bloco areia com a colmeia quando não há foto) */}
        <div style={{ width: 560, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.areia2 }}>
          {photo ? (
            <img src={photo} width={560} height={630} style={{ objectFit: "cover", width: 560, height: 630 }} alt="" />
          ) : (
            <svg width="200" height="200" viewBox="0 0 512 512">
              <polygon points="256,34 450,147 450,371 256,478 62,371 62,147" fill="none" stroke={C.verdeMedio} strokeWidth="18" strokeOpacity="0.35" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 52px" }}>
          <BrandLockup size={44} />

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {item?.category?.name && (
              <span style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 20, color: C.salvia, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {item.category.name}
              </span>
            )}
            <span
              style={{
                fontFamily: "Bricolage",
                fontWeight: 800,
                fontSize: (item?.title.length ?? 0) > 34 ? 46 : 58,
                lineHeight: 1.05,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item?.title ?? "Equipamento para alugar"}
            </span>
            {item && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 52, color: C.salvia }}>{kz(Number(item.pricePerDay))}</span>
                <span style={{ fontFamily: "DM Sans", fontWeight: 500, fontSize: 26, color: C.salviaTint }}>por dia</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {item && placeOf(item) && (
              <span style={{ fontFamily: "DM Sans", fontWeight: 500, fontSize: 24, color: C.salviaTint }}>{placeOf(item)}</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {item?.ownerVerified && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "DM Sans",
                    fontWeight: 700,
                    fontSize: 20,
                    color: C.verde,
                    backgroundColor: C.salviaTint,
                    borderRadius: 999,
                    padding: "6px 16px",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={C.verdeMedio} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Dono verificado
                </span>
              )}
              <span style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 22, color: C.salvia }}>{SITE_HOST}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
  return toJpeg(image);
}

/** PNG do ImageResponse → JPEG (sharp, que já vem com o Next). Se o sharp faltar, devolve o PNG. */
async function toJpeg(image: ImageResponse): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  const headers = { "cache-control": "public, max-age=3600, s-maxage=3600" };
  try {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(png).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { ...headers, "content-type": "image/jpeg" } });
  } catch {
    return new Response(new Uint8Array(png), { headers: { ...headers, "content-type": "image/png" } });
  }
}

/** A foto vem por URL assinada do armazenamento; embutida como data URL (falha → bloco sem foto). */
async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png)/.test(type)) return null; // o gerador (Satori) não lê WebP
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
