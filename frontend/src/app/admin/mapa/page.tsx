"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Info, MapPinOff } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { Callout, Card, Skeleton } from "@/components/bz/ui";
import { heatmapApi } from "@/lib/api-ops";
import { HEAT_SCALE } from "@/lib/heat";
import type { Heatmap, HeatmapScope } from "@/lib/types-ops";
import { useResource } from "@/lib/use-resource";

// Leaflet só nesta página e só no browser
const HeatMap = dynamic(() => import("@/components/bz/heat-map"), {
  ssr: false,
  loading: () => <Skeleton role="status" aria-label="A carregar o mapa" className="h-[420px] rounded-cartao md:h-[520px]" />,
});

const SCOPES: { value: HeatmapScope; label: string; what: string }[] = [
  { value: "KYC_APPROVED", label: "Verificados", what: "pessoas com identidade verificada" },
  { value: "KYC_SUBMITTED", label: "KYC enviado", what: "pessoas que enviaram documentos" },
  { value: "SIGNUP", label: "Registos", what: "registos com localização partilhada" },
];

/** Admin › Mapa: onde está a procura, para decidir a 2.ª província (decisoes-produto.md 2026-11-17, ponto 6). */
export default function MapaPage() {
  const [scope, setScope] = useState<HeatmapScope>("KYC_APPROVED");
  const heat = useResource<Heatmap>(`admin:heatmap:${scope}`, () => heatmapApi.get(scope));
  const current = SCOPES.find((s) => s.value === scope)!;
  const total = heat.data?.byProvince.reduce((n, p) => n + p.count, 0) ?? 0;

  return (
    <div className="grid max-w-6xl gap-5">
      <AdminHeader title="Mapa" text="Onde estão as pessoas que se registam e se verificam. Serve para decidir onde abrir a seguir." />

      <Segmented<HeatmapScope> label="O que mostrar" value={scope} onChange={setScope} options={SCOPES.map(({ value, label }) => ({ value, label }))} className="max-w-xl" />

      <Callout tone="info" icon={Info}>
        Dados agregados, mínimo {heat.data?.minCount ?? 3} por zona — não mostra pessoas.
      </Callout>

      {heat.error ? (
        <Card><ErrorState message={heat.error} onRetry={heat.reload} /></Card>
      ) : !heat.data ? (
        <Skeleton role="status" aria-label="A carregar o mapa" className="h-[420px] rounded-cartao md:h-[520px]" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="grid gap-3">
            {heat.data.cells.length === 0 ? (
              <Card>
                <EmptyState icon={MapPinOff} title="Ainda sem zonas com dados" text={`Cada zona só aparece com ${heat.data.minCount} ou mais ${current.what}.`} />
              </Card>
            ) : (
              <HeatMap data={heat.data} label={`Mapa de calor: ${current.what}, por zonas de cerca de 5 km`} />
            )}
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-cinza" aria-hidden>
              <span>Menos</span>
              {HEAT_SCALE.map((c) => (
                <span key={c} className="h-3 w-8 rounded-sm border border-borda" style={{ background: c }} />
              ))}
              <span>Mais</span>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="grid gap-1 p-5">
              <p className="text-sm text-cinza">Fora das zonas ativas</p>
              <p className="num font-titulo text-3xl font-extrabold text-verde">{heat.data.outsideAreas}</p>
              <p className="text-[13px] text-cinza">{current.what} longe das zonas onde já se publica.</p>
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full text-left text-[15px]">
                <caption className="px-4 pt-4 pb-2 text-left font-titulo text-lg font-bold text-verde">Por província</caption>
                <thead className="bg-areia">
                  <tr>
                    <th scope="col" className="border-b border-borda px-4 py-2 text-xs font-bold tracking-[0.1em] text-cinza uppercase">Província</th>
                    <th scope="col" className="border-b border-borda px-4 py-2 text-right text-xs font-bold tracking-[0.1em] text-cinza uppercase">Pessoas</th>
                  </tr>
                </thead>
                <tbody>
                  {heat.data.byProvince.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-sm text-cinza">Sem dados.</td>
                    </tr>
                  ) : (
                    [...heat.data.byProvince]
                      .sort((a, b) => b.count - a.count)
                      .map((p) => (
                        <tr key={p.province} className="border-b border-borda last:border-0">
                          <th scope="row" className="px-4 py-2 font-medium text-verde">{p.province}</th>
                          <td className="num px-4 py-2 text-right">
                            {p.count}
                            {total > 0 && <span className="ml-2 text-[13px] text-cinza">{Math.round((p.count / total) * 100)}%</span>}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
