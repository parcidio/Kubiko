"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import { TextArea } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { PageHeader } from "@/components/bz/shell";
import { BackLink, Button } from "@/components/bz/ui";
import { bookingApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { useResource } from "@/lib/use-resource";
import { bookingCode } from "@/lib/booking";
import { cn } from "@/lib/utils";

const LABELS = ["", "Correu mal", "Podia ser melhor", "Correu bem", "Muito bom", "Excelente"];

export default function AvaliarPage() {
  const session = useRequireSession();
  const { id } = useParams<{ id: string }>();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const existing = useResource(session ? `review:${id}` : null, () => bookingApi.review(id));

  if (!session) return null;
  const done = existing.data;

  async function send() {
    setSending(true);
    try {
      await bookingApi.createReview(id, { rating: stars, comment: text.trim() || undefined });
      toast.success("Obrigado! A tua avaliação já está no equipamento.");
      existing.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto grid max-w-md gap-5">
        <BackLink href={`/reservas/${id}`}>Reserva {bookingCode(id)}</BackLink>
        <PageHeader title="Já avaliaste" subtitle={`Deste ${done.rating} de 5. Obrigado por ajudares os próximos.`} />
        {done.comment && <p className="rounded-cartao bg-areia-2 p-4 text-verde">“{done.comment}”</p>}
      </div>
    );
  }

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
                className={cn("size-11 transition peer-focus-visible:scale-110 active:scale-90", n <= stars ? "animate-estrela fill-ambar text-ambar" : "text-borda-forte")}
                strokeWidth={1.5}
                aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              />
            </label>
          ))}
        </div>
        <p className="h-6 font-bold text-verde" aria-live="polite">{LABELS[stars]}</p>
      </fieldset>
      <TextArea label="Uma frase sobre o aluguer (opcional)" value={text} onChange={setText} rows={3} maxLength={1000} />
      <Button size="lg" block disabled={!stars} loading={sending} onClick={send}>
        Enviar avaliação
      </Button>
    </div>
  );
}
