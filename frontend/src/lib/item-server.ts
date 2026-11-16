/**
 * Leitura de um equipamento no servidor do Next (metadados e imagem de partilha). Fala com a API pela rede interna
 * (API_URL, ex.: http://api:8080 no Docker). Só dados públicos; falhas devolvem null (a página continua a funcionar).
 */
export type PublicItem = {
  id: string;
  title: string;
  description: string | null;
  pricePerDay: number;
  city: string | null;
  province: string | null;
  ownerVerified: boolean;
  category: { name: string } | null;
  photos: { photUrl: string; position: number }[];
};

const API = (process.env.API_URL || "http://localhost:8081").replace(/\/$/, "");

export async function getPublicItem(id: string): Promise<PublicItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${API}/api/v1/items/${id}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicItem;
  } catch {
    return null;
  }
}

export function placeOf(item: Pick<PublicItem, "city" | "province">) {
  return [item.city, item.province].filter(Boolean).join(", ");
}
