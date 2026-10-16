"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemPhoto, StickyCTABar } from "@/components/beeznoo/booking-ui";
import { ErrorState } from "@/components/beeznoo/states";
import { catalogApi } from "@/lib/api";
import { CONDITION_LABEL, formatKz } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useResource } from "@/lib/use-resource";
import type { Item } from "@/lib/types";

export default function EquipamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, error, reload } = useResource<Item>(`item:${id}`, () => catalogApi.item(id));
  const [photo, setPhoto] = useState(0);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!item) {
    return (
      <div role="status" aria-label="A carregar" className="grid gap-4 md:grid-cols-2 md:gap-8">
        <Skeleton className="aspect-[4/3]" />
        <div className="grid content-start gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const photos = [...item.photos].sort((a, b) => a.position - b.position);
  const available = item.status === "ACTIVE";

  return (
    <div className="grid gap-6">
      <Link href="/explorar" className="flex items-center gap-1 text-sm text-mel-texto hover:underline">
        <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden /> Explorar
      </Link>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className="grid gap-2">
          <ItemPhoto src={photos[photo]?.photUrl} alt={item.title} className="rounded-bz-md border border-borda" />
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Foto ${i + 1}`}
                  aria-pressed={i === photo}
                  className={cn("w-20 shrink-0 overflow-hidden rounded-bz-sm border-2", i === photo ? "border-verde" : "border-transparent")}
                >
                  <ItemPhoto src={p.photUrl} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            {item.category && <span className="text-xs tracking-[0.1em] text-mel-texto uppercase">{item.category.name}</span>}
            <h1 className="font-heading text-[26px] leading-tight text-verde md:text-[32px]">{item.title}</h1>
            <p className="flex items-center gap-1 text-cinza">
              <MapPin className="size-4" strokeWidth={1.8} aria-hidden />
              {[item.city, item.province].filter(Boolean).join(", ") || "Luanda"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutro">{CONDITION_LABEL[item.condition] ?? item.condition}</Badge>
              {!available && <Badge variant="erro">Indisponível</Badge>}
            </div>
          </div>

          <p className="text-verde">
            <span className="font-heading text-[22px]">{formatKz(item.pricePerDay)}</span>
            <span className="text-cinza"> /dia</span>
            {item.depositAmount ? <span className="block text-sm text-cinza">Caução reembolsável: {formatKz(item.depositAmount)}</span> : null}
          </p>

          {item.description && <p className="whitespace-pre-line text-texto-corpo">{item.description}</p>}

          <div className="flex items-center gap-3 rounded-bz-md border border-borda bg-branco p-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-areia-2">
              <UserRound className="size-5 text-mel" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-xs tracking-[0.1em] text-cinza uppercase">Dono</p>
              <p className="font-medium text-verde">{item.ownerName}</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-bz-md bg-salvia-tint p-3 text-sm text-verde">
            <ShieldCheck className="size-5 shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
            <p>Pagas ao Beeznoo, não ao dono. A caução volta para ti depois da devolução e inspeção.</p>
          </div>

          <StickyCTABar>
            {available ? (
              <Button asChild className="w-full">
                <Link href={`/equipamento/${item.id}/reservar`}>Pedir reserva</Link>
              </Button>
            ) : (
              <Button disabled className="w-full">Indisponível</Button>
            )}
          </StickyCTABar>
        </div>
      </div>
    </div>
  );
}
