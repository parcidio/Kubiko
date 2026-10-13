import { Item } from "@/lib/marketplace";
import { MapPin, Star } from "lucide-react";

export default function ItemInformation({item, extra}: {item: Item; extra: {location: string; weekly: number; monthly: number;}})
{
    return (
        <section className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xs bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                {item.categoria}
              </span>
              <span className="rounded-xs bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                Particular
              </span>
            </div>

            <h1 className="mt-2 wrap-break-word text-2xl font-bold text-foreground lg:text-3xl">
              {item.nome}
            </h1>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{extra.location} · ponto exacto após aceitação</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">
              {item.precoPorDia.toLocaleString("pt-AO")} Kz
              <span className="text-sm font-normal text-muted-foreground"> /dia</span>
            </p>
            {extra.weekly > 0 && (
              <p className="text-xs text-muted-foreground">
                {extra.weekly.toLocaleString("pt-AO")} Kz/semana ·{" "}
                {extra.monthly.toLocaleString("pt-AO")} Kz/mês
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="text-sm font-semibold">{item.avaliacao}</span>
              <span className="text-xs text-muted-foreground">/ 5.0</span>
            </div>
          </section>
    )
}