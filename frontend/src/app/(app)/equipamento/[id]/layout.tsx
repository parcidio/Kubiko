import type { Metadata } from "next";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getPublicItem, placeOf } from "@/lib/item-server";

/**
 * Metadados por equipamento: quem partilha o link no WhatsApp vê o nome, o preço por dia e o bairro
 * (a imagem vem de ./opengraph-image.tsx). A página em si continua a ser um componente de cliente.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getPublicItem(id);
  const dict = await getT();
  const t = dict.item;
  if (!item) return { title: t.metaFallback };

  const price = `${Math.round(Number(item.pricePerDay)).toLocaleString("de-DE")} ${dict.common.kzPerDay}`;
  const where = placeOf(item);
  const title = `${item.title} · ${price}`;
  const description = [
    where && fmt(t.metaIn, { where }),
    item.ownerVerified ? t.metaVerified : null,
    t.metaPitch,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${item.title} · Beeznoo`,
    description,
    openGraph: { title, description, type: "website", url: `/equipamento/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function EquipamentoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
