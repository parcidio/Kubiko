"use client";

import { useEffect, useState } from "react";
import { SERVICE_FEE_RATE } from "./format";

/**
 * Taxa de serviço (0.08 = 8%) vinda da API (GET /api/v1/config ← PAYMENTS_SERVICE_FEE_RATE).
 * Uma só fonte de verdade: o ecrã mostra o que a API cobra. Pedido único por sessão do browser, partilhado por
 * todos os componentes (ex.: os cartões do Explorar). Enquanto não chega, ou se falhar, usa SERVICE_FEE_RATE.
 */
let cached: number | null = null;
let inflight: Promise<number> | null = null;

function load(): Promise<number> {
  inflight ??= fetch("/api/v1/config")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((c: { serviceFeeRate?: number | string }) => {
      const v = Number(c.serviceFeeRate);
      cached = Number.isFinite(v) && v >= 0 && v < 1 ? v : SERVICE_FEE_RATE;
      return cached;
    })
    .catch(() => {
      inflight = null; // tenta outra vez na próxima montagem
      return SERVICE_FEE_RATE;
    });
  return inflight;
}

export function useServiceFeeRate(): number {
  const [rate, setRate] = useState(cached ?? SERVICE_FEE_RATE);
  useEffect(() => {
    if (cached !== null) return;
    let alive = true;
    load().then((v) => alive && setRate(v));
    return () => {
      alive = false;
    };
  }, []);
  return rate;
}

/** "8%" (sem casas decimais quando a taxa é redonda, "7,5%" quando não é). */
export function formatFeeRate(rate: number) {
  return `${(rate * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}
