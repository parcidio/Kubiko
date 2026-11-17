import type { LatLng } from "./types-ops";

/**
 * Localização aproximada com consentimento (decisoes-produto.md 2026-11-17, ponto 5).
 * Arredondamos a 2 casas decimais (~1 km) já no browser: a posição exata nunca sai do telemóvel.
 * Controlo de produto, não de segurança: o browser pode ser enganado.
 */

export type ApproxLocation = LatLng & { accuracyM?: number };
export type LocationFailure = "unsupported" | "denied" | "unavailable" | "timeout";

export class LocationError extends Error {
  constructor(public reason: LocationFailure) {
    super(LOCATION_FAILURE_TEXT[reason]);
  }
}

export const LOCATION_FAILURE_TEXT: Record<LocationFailure, string> = {
  unsupported: "Este browser não dá a localização. Experimenta o Chrome ou o Safari atualizados.",
  denied: "Bloqueaste a localização para a Beeznoo. Ativa-a nas definições do browser (cadeado ao lado do endereço) e tenta outra vez.",
  unavailable: "Não conseguimos saber onde estás. Liga a localização do telemóvel e tenta outra vez.",
  timeout: "A localização está a demorar. Vai para perto de uma janela ou liga os dados e tenta outra vez.",
};

/** 2 casas decimais ≈ 1,1 km no equador. */
export function roundCoord(n: number) {
  return Math.round(n * 100) / 100;
}

export function roundLocation<T extends LatLng>(loc: T): T {
  return { ...loc, lat: roundCoord(loc.lat), lng: roundCoord(loc.lng) };
}

/** Estado da permissão sem a pedir. "unknown" quando o browser não suporta a Permissions API (Safari antigo). */
export async function locationPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (!("permissions" in navigator)) return "unknown";
    const st = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return st.state;
  } catch {
    return "unknown";
  }
}

/** Pede a posição ao browser (baixa precisão: poupa bateria e chega para ~1 km). */
export function getApproxLocation(timeoutMs = 12_000): Promise<ApproxLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new LocationError("unsupported"));
    // o timeout do browser só conta depois de autorizado; este cobre também quem ignora o pedido
    const guard = setTimeout(() => reject(new LocationError("timeout")), timeoutMs + 20_000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(guard);
        resolve(
          roundLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.max(1000, Math.round(pos.coords.accuracy)) : undefined,
          }),
        );
      },
      (err) => {
        clearTimeout(guard);
        reject(new LocationError(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable"));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60_000 },
    );
  });
}

/** Coordenadas sem a precisão (para o corpo de POST /items e do registo). */
export function toLatLng(loc: ApproxLocation): LatLng {
  return { lat: loc.lat, lng: loc.lng };
}
