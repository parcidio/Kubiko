"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import { HexTile } from "./hex";
import { Sheet } from "./overlay";
import { SelectField } from "./form";
import { Button, ButtonLink, Callout, Spinner } from "./ui";
import { ApiError, type PublishWhere } from "@/lib/api";
import { locationApi, serviceAreaApi } from "@/lib/api-ops";
import { useSession } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { getApproxLocation, getLocationIfGranted, LocationError, locationPermission, toLatLng, type ApproxLocation } from "@/lib/location";
import { useResource } from "@/lib/use-resource";

/**
 * Explica antes de o browser perguntar (o pedido nativo não diz porquê). Só depois de "Permitir" chamamos a API
 * de geolocalização. `required`: sem "Agora não" (publicar), mas Fechar continua a funcionar.
 */
export function LocationSheet({
  open, onClose, onLocated, required, title,
}: {
  open: boolean;
  onClose: () => void;
  onLocated: (loc: ApproxLocation) => void;
  required?: boolean;
  title?: string;
}) {
  const dict = useT();
  const t = dict.location;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function allow() {
    setBusy(true);
    setError(undefined);
    try {
      onLocated(await getApproxLocation());
    } catch (e) {
      setError(e instanceof LocationError ? e.message : t.locateFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? t.sheetTitle}
      footer={
        <div className="flex gap-3">
          {!required && (
            <Button variant="ghost" onClick={onClose}>
              {t.notNow}
            </Button>
          )}
          <Button variant="dark" block loading={busy} onClick={allow}>
            <LocateFixed strokeWidth={1.8} aria-hidden /> {error ? dict.common.retry : t.allow}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 pt-2">
        <HexTile icon={MapPin} tone="salvia" size={56} />
        <p className="text-[15px]">{t.why}</p>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-cinza">
          <li>{t.rounded}</li>
          <li>{required ? t.requiredNote : t.optionalNote}</li>
          <li>{t.revoke}</li>
        </ul>
        {error && (
          <p role="alert" className="rounded-campo bg-erro-tint p-3 text-sm text-erro">
            {error}
          </p>
        )}
        <Link href="/privacidade#localizacao" target="_blank" className="text-sm font-medium text-mel-texto underline">
          {t.howWeHandle}
        </Link>
      </div>
    </Sheet>
  );
}

/**
 * Pede a localização com a explicação primeiro. Se o browser já a autorizou, não mostra a folha.
 * `request()` resolve com a posição ou null (recusou ou fechou).
 */
export function useLocationRequest({ required, title }: { required?: boolean; title?: string } = {}) {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: ApproxLocation | null) => void) | null>(null);

  const finish = useCallback((v: ApproxLocation | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpen(false);
  }, []);

  const request = useCallback(async (): Promise<ApproxLocation | null> => {
    // já autorizado neste browser: sem folha, em silêncio e com tempo máximo curto; se falhar, a folha explica
    const silent = await getLocationIfGranted();
    if (silent) return silent;
    resolver.current?.(null);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    });
  }, []);

  const sheet = <LocationSheet open={open} required={required} title={title} onClose={() => finish(null)} onLocated={(l) => finish(l)} />;
  return { request, sheet };
}

/** Opção "partilhar localização" (registo e KYC): opcional, nunca bloqueia. */
export function LocationOptIn({ value, onChange }: { value: ApproxLocation | null; onChange: (v: ApproxLocation | null) => void }) {
  const t = useT().location;
  const { request, sheet } = useLocationRequest();
  return (
    <div className="flex items-start gap-3 rounded-cartao border border-borda bg-branco p-4">
      <MapPin className="mt-0.5 size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-bold text-verde">{t.optInTitle}</p>
        {value ? (
          <p className="flex items-center gap-1.5 text-sm text-verde-medio" role="status">
            <CheckCircle2 className="size-4" strokeWidth={1.8} aria-hidden /> {t.optInAdded}
          </p>
        ) : (
          <p className="text-sm text-cinza">{t.optInHint}</p>
        )}
      </div>
      {value ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          {t.remove}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={async () => onChange(await request())}>
          {t.share}
        </Button>
      )}
      {sheet}
    </div>
  );
}

/** Fora das zonas ativas (403 area_not_available). */
export function AreaNotAvailable({ areas, onRetry }: { areas?: { province: string; city: string }[]; onRetry?: () => void }) {
  const t = useT().location;
  const list = areas?.length ? areas.map((a) => (a.city === a.province ? a.city : `${a.city} (${a.province})`)).join(", ") : "Luanda";
  return (
    <div className="mx-auto grid max-w-md animate-sobe justify-items-center gap-4 py-10 text-center">
      <HexTile icon={MapPinOff} tone="ambar-tint" size={80} className="text-mel" />
      <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde">{t.outsideTitle}</h1>
      <p className="text-cinza">{t.outsideText}</p>
      <p className="text-sm text-cinza">{fmt(t.openAreas, { list })}</p>
      <div className="grid w-full gap-2">
        <ButtonLink href="/explorar" variant="dark" block>
          {t.goExplore}
        </ButtonLink>
        {onRetry && (
          <Button variant="ghost" block onClick={onRetry}>
            {t.retryInLuanda}
          </Button>
        )}
      </div>
    </div>
  );
}

export function isAreaNotAvailable(e: unknown) {
  return e instanceof ApiError && e.status === 403 && e.code === "area_not_available";
}

export function isLocationRequired(e: unknown) {
  return e instanceof ApiError && e.status === 422 && e.code === "location_required";
}

export function areaLabel(a: { province: string; city: string }) {
  return a.city === a.province ? a.city : `${a.city} (${a.province})`;
}

type AreaRef = { province: string; city: string };

export type PublishLocationState =
  | { kind: "checking" }
  | { kind: "gps"; location: ApproxLocation; area: AreaRef | null }
  | { kind: "stored"; area: AreaRef | null }
  | { kind: "manual"; areaId: string; area: AreaRef }
  | { kind: "needed"; message?: string }
  | { kind: "outside"; areas: AreaRef[] };

/**
 * Zona para publicar, sem nunca bloquear o formulário (bug de 2026-11-18: o ecrã ficava preso à espera da localização).
 * Por ordem: (1) se o browser já autorizou, posição em silêncio (≤ 8 s); (2) senão, a zona guardada na conta
 * (consentimento dado noutro dispositivo); (3) senão, a pessoa escolhe: "Usar a minha localização" ou a zona à mão.
 * A API volta a verificar ao publicar.
 */
export function usePublishLocation({ title }: { title?: string } = {}) {
  const { request, sheet } = useLocationRequest({ required: true, title });
  const [state, setState] = useState<PublishLocationState>({ kind: "checking" });
  const attempt = useRef(0);

  // regista (APP) e diz se está numa zona; sem rede, segue com a posição e a API decide ao publicar
  const check = useCallback(async (loc: ApproxLocation): Promise<PublishLocationState> => {
    try {
      const r = await locationApi.report({ ...loc, context: "APP" });
      if (r.inServiceArea) return { kind: "gps", location: loc, area: r.area };
      const areas = await serviceAreaApi.active().catch(() => []);
      return { kind: "outside", areas };
    } catch {
      return { kind: "gps", location: loc, area: null };
    }
  }, []);

  useEffect(() => {
    const mine = ++attempt.current;
    let alive = true;
    (async () => {
      const [loc, status] = await Promise.all([getLocationIfGranted(), locationApi.status().catch(() => null)]);
      if (!alive || mine !== attempt.current) return;
      if (loc) {
        const next = await check(loc);
        if (alive && mine === attempt.current) setState(next);
        return;
      }
      setState(status?.storedZoneUsable ? { kind: "stored", area: status.area } : { kind: "needed" });
    })();
    return () => {
      alive = false;
    };
  }, [check]);

  /** "Usar a minha localização": explica, pede ao browser e confirma a zona. */
  const askDevice = useCallback(async () => {
    const mine = ++attempt.current;
    setState({ kind: "checking" });
    const loc = await request();
    if (mine !== attempt.current) return;
    if (!loc) return setState({ kind: "needed" });
    const next = await check(loc);
    if (mine === attempt.current) setState(next);
  }, [request, check]);

  const chooseArea = useCallback((areaId: string, area: AreaRef) => {
    ++attempt.current;
    setState({ kind: "manual", areaId, area });
  }, []);

  const reset = useCallback((message?: string) => {
    ++attempt.current;
    setState({ kind: "needed", message });
  }, []);

  /** O que vai no pedido de publicar; null = ainda falta a zona. */
  const where: PublishWhere | null =
    state.kind === "gps" ? { location: toLatLng(state.location) } : state.kind === "manual" ? { areaId: state.areaId } : state.kind === "stored" ? {} : null;

  return { state, where, askDevice, chooseArea, reset, sheet };
}

/** Cartão no topo de Publicar: estado da zona, sem tapar o formulário. A folha fica sempre montada (o pedido espera por ela). */
export function PublishLocationCard({ loc, id }: { loc: ReturnType<typeof usePublishLocation>; id?: string }) {
  return (
    <div id={id}>
      <PublishLocationStatus loc={loc} />
      {loc.sheet}
    </div>
  );
}

function PublishLocationStatus({ loc }: { loc: ReturnType<typeof usePublishLocation> }) {
  const t = useT().location;
  const { state } = loc;

  if (state.kind === "checking") {
    return (
      <div role="status" className="flex min-h-11 items-center gap-2 text-sm text-cinza">
        <Spinner /> {t.checking}
      </div>
    );
  }
  if (state.kind === "gps" || state.kind === "stored" || state.kind === "manual") {
    const how = state.kind === "gps" ? t.zoneFromDevice : state.kind === "stored" ? t.zoneFromAccount : t.zoneManual;
    return (
      <div className="flex items-center gap-3 rounded-cartao border border-borda bg-branco p-4">
        <MapPin className="size-5 shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
        <div className="grid min-w-0 flex-1 gap-0.5" role="status">
          <p className="font-bold text-verde">{state.area ? fmt(t.zoneLabel, { area: areaLabel(state.area) }) : t.zoneUnconfirmed}</p>
          <p className="text-sm text-cinza">{how}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => loc.reset()}>
          {t.change}
        </Button>
      </div>
    );
  }
  return <ZonePicker loc={loc} />;
}

function ZonePicker({ loc }: { loc: ReturnType<typeof usePublishLocation> }) {
  const dict = useT();
  const t = dict.location;
  const { state } = loc;
  const areas = useResource("service-areas:active", () => serviceAreaApi.active());
  const [areaId, setAreaId] = useState("");
  const list = areas.data ?? [];
  const outside = state.kind === "outside";

  return (
    <Callout
      tone={outside ? "warn" : "info"}
      icon={outside ? MapPinOff : MapPin}
      title={outside ? t.outsideTitle : t.needTitle}
    >
      <div className="grid gap-3">
        <p>{outside ? fmt(t.outsideInline, { list: (state.areas.length ? state.areas : list).map(areaLabel).join(", ") || "Luanda" }) : t.needText}</p>
        {state.kind === "needed" && state.message && (
          <p role="alert" className="text-erro">
            {state.message}
          </p>
        )}
        <Button variant="dark" onClick={() => void loc.askDevice()} className="justify-self-start">
          <LocateFixed strokeWidth={1.8} aria-hidden /> {outside ? dict.common.retry : t.useMyLocation}
        </Button>
        {/* Escolher à mão só quando o browser não deu a posição: quem está fora não passa por aqui (a API também recusa) */}
        {!outside && (
          <div className="grid gap-2">
            {areas.error ? (
              <p className="text-erro">
                {t.areasLoadFailed}{" "}
                <button type="button" className="font-medium underline" onClick={areas.reload}>
                  {dict.common.retry}
                </button>
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <SelectField
                  label={t.chooseZone}
                  value={areaId}
                  onChange={setAreaId}
                  placeholder={areas.data ? t.choosePlaceholder : dict.common.loading}
                  options={list.map((a) => ({ value: a.id, label: areaLabel(a) }))}
                  className="min-w-0 flex-1"
                />
                <Button
                  variant="outline"
                  disabled={!areaId}
                  onClick={() => {
                    const a = list.find((x) => x.id === areaId);
                    if (a) loc.chooseArea(a.id, a);
                  }}
                >
                  {t.useThisZone}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Callout>
  );
}

const APP_ASKED_KEY = "beeznoo.location.app";
const SKIP_PATHS = ["/publicar", "/verificacao"];

/**
 * Uma vez por conta (não por browser), depois de entrar: explica e pede a localização (POST /me/location, contexto APP).
 * - O browser já autorizou → envia em silêncio uma vez por sessão do browser.
 * - A conta já deu consentimento (GET /me/location, outro dispositivo) → não pergunta outra vez; nunca chama a API
 *   do browser sem a permissão estar dada, porque isso mostraria o pedido do browser.
 * Recusar não muda nada na app.
 */
export function AppLocationPrompt() {
  const session = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const profileId = session?.profileId;
  const skip = SKIP_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!profileId || skip) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = `${APP_ASKED_KEY}.${profileId}`;
    (async () => {
      let asked = false;
      let sentThisSession = false;
      try {
        asked = localStorage.getItem(key) !== null;
        sentThisSession = sessionStorage.getItem(key) !== null;
      } catch {
        return; // sem storage: não insistir a cada página
      }
      const perm = await locationPermission();
      if (!alive) return;
      if (perm === "granted") {
        if (sentThisSession) return;
        try {
          sessionStorage.setItem(key, "1");
          const loc = await getApproxLocation({ timeoutMs: 8_000, promptGraceMs: 2_000 });
          await locationApi.report({ ...loc, context: "APP" });
        } catch {
          /* silencioso: é só para o mapa */
        }
        return;
      }
      if (asked || perm === "denied") return;
      // consentimento guardado na conta (outro dispositivo): não voltar a perguntar
      const status = await locationApi.status().catch(() => null);
      if (!alive) return;
      if (status?.consented) {
        remember(profileId);
        return;
      }
      if (!status) return; // sem rede: perguntar noutra altura
      // pequeno atraso: não tapar a primeira página logo ao entrar
      timer = setTimeout(() => alive && setOpen(true), 1500);
    })();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [profileId, skip]);

  return (
    <LocationSheet
      open={open}
      onClose={() => {
        if (profileId) remember(profileId);
        setOpen(false);
      }}
      onLocated={async (loc) => {
        if (profileId) remember(profileId);
        setOpen(false);
        try {
          await locationApi.report({ ...loc, context: "APP" });
          if (profileId) sessionStorage.setItem(`${APP_ASKED_KEY}.${profileId}`, "1");
        } catch {
          /* silencioso */
        }
      }}
    />
  );
}

function remember(profileId: string) {
  try {
    localStorage.setItem(`${APP_ASKED_KEY}.${profileId}`, new Date().toISOString());
  } catch {
    /* sem storage */
  }
}
