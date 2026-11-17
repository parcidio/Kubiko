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
import { getApproxLocation, LocationError, locationPermission, type ApproxLocation } from "@/lib/location";
import type { PublishEligibility } from "@/lib/types-ops";

export const AREA_NOT_AVAILABLE_TEXT = "Ainda não estamos na tua zona — o piloto é em Luanda. Avisamos-te quando chegarmos.";

export const LOCATION_WHY = "Usamos a tua localização aproximada para saber se a Beeznoo já está na tua zona. Não partilhamos com ninguém.";

/**
 * Explica antes de o browser perguntar (o pedido nativo não diz porquê). Só depois de "Permitir" chamamos a API
 * de geolocalização. `required`: sem "Agora não" (publicar), mas Fechar continua a funcionar.
 */
export function LocationSheet({
  open, onClose, onLocated, required, title = "Partilhar a tua localização?",
}: {
  open: boolean;
  onClose: () => void;
  onLocated: (loc: ApproxLocation) => void;
  required?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function allow() {
    setBusy(true);
    setError(undefined);
    try {
      onLocated(await getApproxLocation());
    } catch (e) {
      setError(e instanceof LocationError ? e.message : "Não conseguimos saber onde estás. Tenta outra vez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          {!required && (
            <Button variant="ghost" onClick={onClose}>
              Agora não
            </Button>
          )}
          <Button variant="dark" block loading={busy} onClick={allow}>
            <LocateFixed strokeWidth={1.8} aria-hidden /> {error ? "Tentar outra vez" : "Permitir localização"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 pt-2">
        <HexTile icon={MapPin} tone="salvia" size={56} />
        <p className="text-[15px]">{LOCATION_WHY}</p>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-cinza">
          <li>Guardamos só uma posição arredondada a cerca de 1 km, nunca a morada.</li>
          <li>{required ? "Para publicar equipamento é obrigatório: o piloto é só em Luanda." : "É opcional. Podes continuar sem partilhar."}</li>
          <li>Podes retirar a autorização a qualquer momento nas definições do browser.</li>
        </ul>
        {error && (
          <p role="alert" className="rounded-campo bg-erro-tint p-3 text-sm text-erro">
            {error}
          </p>
        )}
        <Link href="/privacidade#localizacao" target="_blank" className="text-sm font-medium text-mel-texto underline">
          Como tratamos a localização
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
  const { request, sheet } = useLocationRequest();
  return (
    <div className="flex items-start gap-3 rounded-cartao border border-borda bg-branco p-4">
      <MapPin className="mt-0.5 size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-bold text-verde">Localização aproximada (opcional)</p>
        {value ? (
          <p className="flex items-center gap-1.5 text-sm text-verde-medio" role="status">
            <CheckCircle2 className="size-4" strokeWidth={1.8} aria-hidden /> Adicionada, arredondada a cerca de 1 km.
          </p>
        ) : (
          <p className="text-sm text-cinza">Ajuda-nos a saber onde abrir a seguir. Não partilhamos com ninguém.</p>
        )}
      </div>
      {value ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Remover
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={async () => onChange(await request())}>
          Partilhar
        </Button>
      )}
      {sheet}
    </div>
  );
}

/** Fora das zonas ativas (403 area_not_available). */
export function AreaNotAvailable({ areas, onRetry }: { areas?: { province: string; city: string }[]; onRetry?: () => void }) {
  const list = areas?.length ? areas.map((a) => (a.city === a.province ? a.city : `${a.city} (${a.province})`)).join(", ") : "Luanda";
  return (
    <div className="mx-auto grid max-w-md animate-sobe justify-items-center gap-4 py-10 text-center">
      <HexTile icon={MapPinOff} tone="ambar-tint" size={80} className="text-mel" />
      <h1 className="font-titulo text-[26px] leading-tight font-bold text-verde">Ainda não estamos na tua zona</h1>
      <p className="text-cinza">O piloto é em Luanda. Avisamos-te quando chegarmos.</p>
      <p className="text-sm text-cinza">Zonas abertas: {list}. Podes continuar a usar a conta e verificar a identidade.</p>
      <div className="grid w-full gap-2">
        <ButtonLink href="/explorar" variant="dark" block>
          Ir para Explorar
        </ButtonLink>
        {onRetry && (
          <Button variant="ghost" block onClick={onRetry}>
            Já estou em Luanda, verificar outra vez
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
  const { request, sheet } = useLocationRequest({ required: true, title: "Para publicar, precisamos da tua localização" });
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
      update({ kind: "error", message: e instanceof Error ? e.message : "Algo correu mal." });
    }
  }, [request]);

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
          title={state.kind === "error" ? "Não conseguimos confirmar a tua zona" : "Sem localização não dá para publicar"}
          action={<Button variant="dark" onClick={run}>Tentar outra vez</Button>}
        >
          {state.kind === "error" ? state.message : `${LOCATION_WHY} Durante o piloto só se publica equipamento em Luanda.`}
        </Callout>
        <ButtonLink href="/explorar" variant="ghost">Voltar a Explorar</ButtonLink>
      </div>
    );
  } else {
    body = (
      <div role="status" aria-label={state.kind === "checking" ? "A confirmar a tua zona" : "À espera da localização"} className="mx-auto grid max-w-2xl gap-4">
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
