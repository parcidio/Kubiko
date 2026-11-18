import type { LatLng } from "./types-ops";

/**
 * Localização aproximada com consentimento (decisoes-produto.md 2026-11-17, ponto 5, e 2026-11-18).
 * Arredondamos a 2 casas decimais (~1 km) já no browser: a posição exata nunca sai do telemóvel.
 * Controlo de produto, não de segurança: o browser pode ser enganado.
 *
 * Regras para nunca prender a interface (bug de 2026-11-18, "Publicar demora ou congela"):
 * - a Permissions API pode não responder (WebViews, Safari antigo): `locationPermission` desiste ao fim de 1,5 s;
 * - `getCurrentPosition` pode nunca chamar nenhum callback (pedido do browser ignorado): há sempre um temporizador
 *   nosso por cima, e o temporizador do browser só conta depois de a pessoa responder;
 * - pedidos ao mesmo tempo partilham a mesma promessa, e uma posição recente fica em memória 5 min.
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
  denied: "A localização está bloqueada para a Beeznoo. Ativa-a nas definições do browser (cadeado ao lado do endereço) e tenta outra vez.",
  unavailable: "Não conseguimos saber onde estás. Liga a localização do telemóvel e tenta outra vez.",
  timeout: "A localização está a demorar. Tenta outra vez perto de uma janela ou com os dados ligados.",
};

/** 2 casas decimais ≈ 1,1 km no equador. */
export function roundCoord(n: number) {
  return Math.round(n * 100) / 100;
}

export function roundLocation<T extends LatLng>(loc: T): T {
  return { ...loc, lat: roundCoord(loc.lat), lng: roundCoord(loc.lng) };
}

const PERMISSION_TIMEOUT_MS = 1_500;

/**
 * Estado da permissão sem a pedir, em no máximo 1,5 s. "unknown" quando o browser não suporta a Permissions API
 * (Safari antigo) ou não responde a tempo. "unknown" nunca autoriza um pedido silencioso: o browser perguntaria.
 */
export async function locationPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (typeof navigator === "undefined" || !("permissions" in navigator) || !navigator.permissions?.query) return "unknown";
    const query = navigator.permissions.query({ name: "geolocation" as PermissionName }).then((st) => st.state);
    const timeout = new Promise<"unknown">((resolve) => setTimeout(() => resolve("unknown"), PERMISSION_TIMEOUT_MS));
    return await Promise.race([query, timeout]);
  } catch {
    return "unknown";
  }
}

export type LocateOptions = {
  /** Tempo do browser para obter a posição depois de autorizado. */
  timeoutMs?: number;
  /** Tempo extra para a pessoa responder ao pedido do browser (0 quando já está autorizado). */
  promptGraceMs?: number;
};

const CACHE_MS = 5 * 60_000;
let cached: { at: number; loc: ApproxLocation } | null = null;
let inFlight: Promise<ApproxLocation> | null = null;

/**
 * Pede a posição ao browser (baixa precisão: rápida, poupa bateria e chega para ~1 km). Resolve sempre: com a posição
 * ou com `LocationError` ao fim de `timeoutMs + promptGraceMs` no máximo.
 */
export function getApproxLocation({ timeoutMs = 10_000, promptGraceMs = 20_000 }: LocateOptions = {}): Promise<ApproxLocation> {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.loc);
  if (inFlight) return inFlight;
  const p = new Promise<ApproxLocation>((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new LocationError("unsupported"));
    let done = false;
    const settle = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      fn();
    };
    // o timeout do browser só começa depois de a pessoa responder; este cobre também quem ignora o pedido
    const guard = setTimeout(() => settle(() => reject(new LocationError("timeout"))), timeoutMs + promptGraceMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          settle(() => {
            const loc = roundLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.max(1000, Math.round(pos.coords.accuracy)) : undefined,
            });
            cached = { at: Date.now(), loc };
            resolve(loc);
          }),
        (err) =>
          settle(() =>
            reject(new LocationError(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable")),
          ),
        // posição até 30 min serve (~1 km); sem alta precisão o GPS não precisa de arrancar
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 30 * 60_000 },
      );
    } catch {
      settle(() => reject(new LocationError("unavailable")));
    }
  });
  inFlight = p;
  const clear = () => {
    if (inFlight === p) inFlight = null;
  };
  p.then(clear, clear);
  return p;
}

/** Só se a permissão já foi dada neste browser: nunca mostra o pedido do browser. null se não der. */
export async function getLocationIfGranted(timeoutMs = 8_000): Promise<ApproxLocation | null> {
  if ((await locationPermission()) !== "granted") return null;
  try {
    return await getApproxLocation({ timeoutMs, promptGraceMs: 2_000 });
  } catch {
    return null;
  }
}

/** Coordenadas sem a precisão (para o corpo de POST /items e do registo). */
export function toLatLng(loc: ApproxLocation): LatLng {
  return { lat: loc.lat, lng: loc.lng };
}
