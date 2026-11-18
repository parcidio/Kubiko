"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { heatColor } from "@/lib/heat";
import type { Heatmap } from "@/lib/types-ops";

/**
 * Mapa de calor do Admin › Mapa. Carregado só nessa página (next/dynamic, sem SSR): Leaflet + mosaicos OSM.
 * Cada célula (~5 km) é um retângulo com a cor pela contagem; sem plugin de heatmap. Nada de pessoas, só contagens ≥ 3.
 * Células grandes (~28 km, tracejado) juntam quem não chega ao mínimo nas pequenas.
 */

const LUANDA: L.LatLngTuple = [-8.84, 13.23];

export default function HeatMap({ data, label }: { data: Heatmap; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = L.map(el.current, {
      center: LUANDA,
      zoom: 7,
      zoomAnimation: !reduce,
      fadeAnimation: !reduce,
      markerZoomAnimation: !reduce,
      scrollWheelZoom: false, // a página faz scroll; zoom com os botões ou dois dedos
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 13, // células de ~5 km: mais zoom não acrescenta nada
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    // o contentor pode nascer sem tamanho (carregamento dinâmico, grelha): sem isto ficam mosaicos cinzentos
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => m.invalidateSize()) : null;
    ro?.observe(el.current);
    return () => {
      ro?.disconnect();
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const max = Math.max(0, ...data.cells.map((c) => c.count));
    const bounds: L.LatLngBounds[] = [];
    for (const c of data.cells) {
      // lat/lng = centro da célula; sizeDeg = lado (~5 km, ou ~28 km para quem não chega ao mínimo nas pequenas)
      const size = c.sizeDeg ?? data.cellSizeDeg;
      const half = size / 2;
      const coarse = size > data.cellSizeDeg;
      const b = L.latLngBounds([c.lat - half, c.lng - half], [c.lat + half, c.lng + half]);
      bounds.push(b);
      L.rectangle(b, {
        color: "#0E2A1F",
        weight: coarse ? 1 : 0.5,
        dashArray: coarse ? "4 4" : undefined,
        fillColor: heatColor(c.count, max),
        fillOpacity: coarse ? 0.45 : 0.7,
      })
        .bindTooltip(`${c.count} ${c.count === 1 ? "pessoa" : "pessoas"} · zona de ~${coarse ? 28 : 5} km`)
        .addTo(g);
    }
    if (bounds.length) {
      const all = bounds.reduce((acc, b) => acc.extend(b), L.latLngBounds(bounds[0].getSouthWest(), bounds[0].getNorthEast()));
      m.fitBounds(all, { padding: [24, 24], maxZoom: 10 });
    } else {
      m.setView(LUANDA, 7);
    }
  }, [data]);

  return <div ref={el} role="region" aria-label={label} className="relative z-0 h-[420px] w-full overflow-hidden rounded-cartao border border-borda md:h-[520px]" />;
}
