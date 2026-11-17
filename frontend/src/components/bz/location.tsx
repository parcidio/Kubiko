"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, LocateFixed, MapPin, MapPinOff } from "lucide-react";
import { HexTile } from "./hex";
import { Sheet } from "./overlay";
import { Button, ButtonLink, Callout, Skeleton } from "./ui";
import { ApiError } from "@/lib/api";
import { locationApi } from "@/lib/api-ops";
import { useSession } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { getApproxLocation, LocationError, locationPermission, type ApproxLocation } from "@/lib/location";
import type { PublishEligibility } from "@/lib/types-ops";

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
    if ((await locationPermission()) === "granted") {
      try {
        return await getApproxLocation();
      } catch {
        /* cai na folha, que mostra o motivo */
      }
    }
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

type GateState =
  | { kind: "asking" }
  | { kind: "denied" }
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "outside"; areas: PublishEligibility["areas"] }
  | { kind: "ok"; location: ApproxLocation };

/**
 * Antes do formulário de publicar: pede a localização (obrigatória) e pergunta à API se a zona está aberta
 * (GET /me/publish-eligibility), para ninguém preencher tudo e ser recusado no fim. A API volta a verificar ao publicar.
 */
export function PublishLocationGate({ children }: { children: (location: ApproxLocation, refresh: () => Promise<ApproxLocation | null>) => React.ReactNode }) {
  const dict = useT();
  const t = dict.location;
  const { request, sheet } = useLocationRequest({ required: true, title: t.publishTitle });
  const [state, setState] = useState<GateState>({ kind: "asking" });

  // só a tentativa mais recente mexe no estado (Strict Mode corre o efeito duas vezes; "Tentar outra vez" recomeça)
  const attempt = useRef(0);
  const run = useCallback(async () => {
    const mine = ++attempt.current;
    const update = (s: GateState) => mine === attempt.current && setState(s);
    update({ kind: "asking" });
    const loc = await request();
    if (!loc) return update({ kind: "denied" });
    update({ kind: "checking" });
    try {
      const el = await locationApi.publishEligibility(loc);
      if (el.allowed) update({ kind: "ok", location: loc });
      else if (el.reason === "area_not_available") update({ kind: "outside", areas: el.areas });
      else update({ kind: "denied" });
    } catch (e) {
      update({ kind: "error", message: e instanceof Error ? e.message : dict.common.somethingWrong });
    }
  }, [request, dict]);

  useEffect(() => {
    // pedir a localização ao abrir é a ação deste ecrã: a folha explica antes do pedido do browser
    void run();
  }, [run]);

  // Ao publicar, a posição volta a ser pedida (pode ter mudado desde que abriu o formulário)
  const refresh = useCallback(async () => {
    const loc = await request();
    if (loc) setState({ kind: "ok", location: loc });
    return loc;
  }, [request]);

  let body: React.ReactNode;
  if (state.kind === "ok") body = children(state.location, refresh);
  else if (state.kind === "outside") body = <AreaNotAvailable areas={state.areas} onRetry={run} />;
  else if (state.kind === "denied" || state.kind === "error") {
    body = (
      <div className="mx-auto grid max-w-md gap-4 py-6">
        <Callout
          tone={state.kind === "error" ? "erro" : "warn"}
          icon={MapPinOff}
          title={state.kind === "error" ? t.cantConfirm : t.noLocationNoPublish}
          action={<Button variant="dark" onClick={run}>{dict.common.retry}</Button>}
        >
          {state.kind === "error" ? state.message : `${t.why} ${t.pilotOnly}`}
        </Callout>
        <ButtonLink href="/explorar" variant="ghost">{t.backExplore}</ButtonLink>
      </div>
    );
  } else {
    body = (
      <div role="status" aria-label={state.kind === "checking" ? t.checking : t.waiting} className="mx-auto grid max-w-2xl gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-cartao" />
      </div>
    );
  }

  return (
    <>
      {body}
      {sheet}
    </>
  );
}

const APP_ASKED_KEY = "beeznoo.location.app";
const SKIP_PATHS = ["/publicar", "/verificacao"];

/**
 * Uma vez por conta, depois de entrar: explica e pede a localização (POST /me/location, contexto APP).
 * Quem já autorizou no browser envia em silêncio uma vez por sessão do browser. Recusar não muda nada na app.
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
          const loc = await getApproxLocation();
          await locationApi.report({ ...loc, context: "APP" });
        } catch {
          /* silencioso: é só para o mapa */
        }
        return;
      }
      if (!asked && perm !== "denied") {
        // pequeno atraso: não tapar a primeira página logo ao entrar
        setTimeout(() => alive && setOpen(true), 1500);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileId, skip]);

  function remember() {
    try {
      if (profileId) localStorage.setItem(`${APP_ASKED_KEY}.${profileId}`, new Date().toISOString());
    } catch {
      /* sem storage */
    }
  }

  return (
    <LocationSheet
      open={open}
      onClose={() => {
        remember();
        setOpen(false);
      }}
      onLocated={async (loc) => {
        remember();
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
