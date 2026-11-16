import { SERVICE_FEE_RATE } from "./format";

/**
 * Taxa de serviço lida no servidor do Next (landing e outras páginas de servidor), da mesma fonte que a app:
 * GET /api/v1/config ← PAYMENTS_SERVICE_FEE_RATE. Revalida a cada 5 min (mudar a variável chega à landing sem
 * novo build). Se a API não responder (ex.: durante o build no Docker), usa SERVICE_FEE_RATE.
 */
const API = (process.env.API_URL || "http://localhost:8081").replace(/\/$/, "");

export async function getServiceFeeRate(): Promise<number> {
  try {
    const res = await fetch(`${API}/api/v1/config`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return SERVICE_FEE_RATE;
    const v = Number((await res.json()).serviceFeeRate);
    return Number.isFinite(v) && v >= 0 && v < 1 ? v : SERVICE_FEE_RATE;
  } catch {
    return SERVICE_FEE_RATE;
  }
}
