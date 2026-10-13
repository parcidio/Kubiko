"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { catalogo } from "@/lib/marketplace";
import ItemGallery from "../../../../components/items/id/Gallery";
import Calendar from "../../../../components/items/id/Calendar";
import ItemConservation from "../../../../components/items/id/Conservation";
import ItemBooking from "../../../../components/items/id/Booking";
import ItemOwner from "../../../../components/items/id/Owner";
import ItemInformation from "../../../../components/items/id/Information";
import ItemDescription from "../../../../components/items/id/Description";
import ItemProtection from "../../../../components/items/id/Protection";

// Dados de demonstração — substituir pela resposta da API quando estiver disponível.
const EXTRA: Record<
  string,
  {
    location: string;
    conservation: string;
    conditionNotes: string[];
    lastCheck: string;
    description: string;
    includes: string[];
    weekly: number;
    monthly: number;
    caucao: number;
  }
> = {
  "1": {
    location: "Talatona",
    conservation: "muito-bom",
    conditionNotes: [
      "Sensor limpo, cerca de 12.000 disparos",
      "Pequeno risco na base (visível na foto 5)",
      "Ecrã e botões sem falhas",
    ],
    lastCheck: "28 Set 2026",
    description:
      "Câmara full-frame ideal para casamentos, eventos e vídeo 4K. Vai com lente zoom 28–70mm, pronta a usar.",
    includes: [
      "Corpo + lente FE 28–70mm",
      "2 baterias e carregador",
      "Cartão SD 64 GB",
      "Mochila de transporte",
    ],
    weekly: 150000,
    monthly: 500000,
    caucao: 150000,
  },
};

const defaultExtra = {
  location: "Luanda",
  conservation: "bom",
  conditionNotes: ["Equipamento em bom estado de conservação"],
  lastCheck: "Out 2026",
  description: "Equipamento disponível para arrendamento em Luanda.",
  includes: ["Equipamento principal", "Acessórios incluídos"],
  weekly: 0,
  monthly: 0,
  caucao: 0,
};

type CalendarSelection = { start: number | null; end: number | null };

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const item = catalogo.find((entry) => entry.id === id);
  const extra = EXTRA[id] ?? defaultExtra;
  const [calDates, setCalDates] = useState<CalendarSelection>({
    start: null,
    end: null,
  });


  const handleCalDay = (day: number) => {
    setCalDates((previous) => {
      if (previous.start === null || previous.end !== null) {
        return { start: day, end: null };
      }
      if (day < previous.start) return { start: day, end: previous.start };
      return { start: previous.start, end: day };
    });
  };

  if (!item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-muted-foreground">Item não encontrado.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-10">
        <ItemGallery id={id} />
      </div>

      {/* Layout principal: detalhes à esquerda, reserva à direita */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-4 pb-8 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:px-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Informações principais */}
          <ItemInformation item={item} extra={extra} />

          {/* Estado de conservação */}
          <ItemConservation id={id} />

          {/* Descrição e acessórios */}
          <ItemDescription extra={extra} />

          {/* Disponibilidade */}
          <section className="min-w-0 rounded-xs border border-border bg-card p-4">
            <h2 className="mb-4 font-bold text-foreground">Disponibilidade</h2>
            <Calendar selected={calDates} onSelect={handleCalDay} />
          </section>
        </div>

        {/* Coluna lateral */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          {/* Reserva — visível também em mobile */}
          <ItemBooking id={id} extra={extra} />

          {/* Proprietário */}
          <ItemOwner />

          {/* Proteção Beeznoo */}
          <ItemProtection />
        </aside>
      </div>
    </main>
  );
}
