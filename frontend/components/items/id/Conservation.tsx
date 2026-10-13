import { catalogo } from "@/lib/marketplace";

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

const CONSERVATION = [
    { value: "novo", label: "Novo" },
    { value: "muito-bom", label: "Muito bom" },
    { value: "bom", label: "Bom" },
    { value: "marcas", label: "Com marcas de uso" },
  ];

export default function ItemConservation({id}: {id: string})
{
    const item = catalogo.find((entry) => entry.id === id);
    const extra = EXTRA[id] ?? defaultExtra;

    return (
        <section className="rounded-xs border border-border bg-card p-4">
            <h2 className="mb-3 font-bold text-foreground">
              Estado de conservação
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONSERVATION.map((condition) => (
                <div
                  key={condition.value}
                  className={`flex min-h-9 items-center justify-center rounded-xs border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                    condition.value === extra.conservation
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {condition.label}
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5">
              {extra.conditionNotes.map((note, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-xs bg-foreground" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Última verificação pelo dono: {extra.lastCheck}
            </p>
        </section>
    )
}