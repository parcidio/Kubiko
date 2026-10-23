"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import { TextArea } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PageHeader } from "@/components/bz/shell";
import { BackendPending } from "@/components/bz/states";
import { BackLink, Button } from "@/components/bz/ui";
import { useRequireSession } from "@/lib/auth";
import { bookingCode } from "@/lib/booking";
import { cn } from "@/lib/utils";

const LABELS = ["", "Correu mal", "Podia ser melhor", "Correu bem", "Muito bom", "Excelente"];

export default function AvaliarPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");

  if (!session) return null;

  return (
    <div className="mx-auto grid max-w-md gap-6">
      <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
      <PageHeader title="Como correu?" subtitle="A tua avaliação ajuda os próximos a confiar." />
      <fieldset className="grid justify-items-center gap-3">
        <legend className="sr-only">Avaliação de 1 a 5</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="stars" value={n} checked={stars === n} onChange={() => setStars(n)} className="peer sr-only" />
              <Star
                className={cn("size-11 transition peer-focus-visible:scale-110 active:scale-90", n <= stars ? "fill-ambar text-ambar" : "text-borda-forte")}
                strokeWidth={1.5}
                aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              />
            </label>
          ))}
        </div>
        <p className="h-6 font-bold text-verde" aria-live="polite">{LABELS[stars]}</p>
      </fieldset>
      <TextArea label="Uma frase sobre o aluguer (opcional)" value={text} onChange={setText} rows={3} maxLength={300} />
      <BackendPending what="Avaliações (ligadas a reservas concluídas) não têm endpoint." />
      <Button size="lg" block disabled={!stars} onClick={() => toast("Ainda não fica guardado: falta o backend das avaliações.")}>
        Enviar avaliação
      </Button>
    </div>
  );
}
