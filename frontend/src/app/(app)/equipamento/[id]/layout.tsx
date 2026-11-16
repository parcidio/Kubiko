import type { Metadata } from "next";
import { getPublicItem, placeOf } from "@/lib/item-server";

/**
 * Metadados por equipamento: quem partilha o link no WhatsApp vê o nome, o preço por dia e o bairro
 * (a imagem vem de ./opengraph-image.tsx). A página em si continua a ser um componente de cliente.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await getPublicItem(id);
  if (!item) return { title: "Equipamento · Beeznoo" };

  const price = `${Math.round(Number(item.pricePerDay)).toLocaleString("de-DE")} Kz/dia`;
  const where = placeOf(item);
  const title = `${item.title} · ${price}`;
  const description = [
    where && `Em ${where}.`,
    item.ownerVerified ? "Dono verificado." : null,
    "Aluga na Beeznoo e paga ao dono, na entrega.",
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
