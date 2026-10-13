import { catalogo } from "@/lib/marketplace";
import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

type CalendarSelection = { start: number | null; end: number | null };

export default function ItemBooking({id, extra}: {id: string; extra: {caucao: number}})
{
    const item = catalogo.find((entry) => entry.id === id);
    const [levantar, setLevantar] = useState("");
    const [devolver, setDevolver] = useState("");
    const [calDates, setCalDates] = useState<CalendarSelection>({ start: null, end: null });
    const dias = useMemo(() => {
        if (!levantar || !devolver) return 0;
        const difference =
          (new Date(`${devolver}T00:00:00`).getTime() -
            new Date(`${levantar}T00:00:00`).getTime()) /
          86400000;
        return Math.max(0, Math.round(difference));
      }, [levantar, devolver]);
    
      const diasCobrados = dias || 3;
      const subtotal = (item?.precoPorDia ?? 0) * diasCobrados;
      const taxa = Math.round(subtotal * 0.08);
      const caucao = extra.caucao || (item?.precoPorDia ?? 0) * 6;
      const total = subtotal + taxa + caucao;
    
      const handleCalDay = (day: number) => {
        setCalDates((previous) => {
          if (previous.start === null || previous.end !== null) {
            return { start: day, end: null };
          }
          if (day < previous.start) return { start: day, end: previous.start };
          return { start: previous.start, end: day };
        });
      };
    
      const abrirWhatsapp = () => {
        if (!item) return;
        const numero = "244932300335";
        const mensagem = `Olá! Tenho interesse no item: ${item.nome}. Id: ${id}`;
        window.open(
          `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
          "_blank",
          "noopener,noreferrer",
        );
      };
    return (
        <section className="min-w-0 rounded-xs border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-4 font-bold text-foreground">Pedir reserva</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="levantar"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Levantar
                </label>
                <input
                  id="levantar"
                  type="date"
                  value={levantar}
                  onChange={(event) => {
                    setLevantar(event.target.value);
                    if (devolver && event.target.value > devolver) setDevolver("");
                  }}
                  className="w-full min-w-0 rounded-xs border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shield"
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="devolver"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Devolver
                </label>
                <input
                  id="devolver"
                  type="date"
                  value={devolver}
                  min={levantar || undefined}
                  onChange={(event) => setDevolver(event.target.value)}
                  className="w-full min-w-0 rounded-xs border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-shield"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">
                  {item?.precoPorDia.toLocaleString("pt-AO")} Kz × {diasCobrados} dias
                </span>
                <span className="shrink-0 tabular-nums">
                  {subtotal.toLocaleString("pt-AO")} Kz
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Taxa de serviço (8%)</span>
                <span className="shrink-0 tabular-nums">
                  {taxa.toLocaleString("pt-AO")} Kz
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Caução reembolsável</span>
                <span className="shrink-0 tabular-nums">
                  {caucao.toLocaleString("pt-AO")} Kz
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-3 font-bold">
                <span>Total a pagar</span>
                <span className="shrink-0 tabular-nums">
                  {total.toLocaleString("pt-AO")} Kz
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              A caução ({caucao.toLocaleString("pt-AO")} Kz) fica retida pela
              Beeznoo e volta para ti até 48h após a devolução confirmada no
              checklist.
            </p>

            <button
              type="button"
              disabled={!item?.disponivel || !levantar || !devolver || dias <= 0}
              className="mt-4 w-full cursor-pointer rounded-xs bg-warning px-4 py-3 text-sm font-bold text-primary transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pedir reserva
            </button>
            <button
              type="button"
              onClick={abrirWhatsapp}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xs border border-border px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
              Só pagas depois de o proprietário aceitar. Ele tem 12 horas para
              responder.
            </p>
        </section>
    )
}