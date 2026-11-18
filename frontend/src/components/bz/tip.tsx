"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { CircleHelp, Lightbulb, X } from "lucide-react";
import { HexTile } from "./hex";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * "Como funciona" contextual (ajuda para quem nunca alugou nada online).
 *
 * Aparece aberto na primeira vez que a pessoa chega a esse momento (Explorar, pedido, cada estado da reserva,
 * Publicar, Verificação, Pedidos). Ao fechar, fica lembrado neste browser (localStorage) e passa a ser só um
 * link discreto "Como funciona?" que o volta a abrir — a ajuda nunca desaparece de vez.
 *
 * `id` estável e específico do momento (ex.: `booking.renter.ACCEPTED`): mudar de estado mostra a dica nova.
 * Sem storage (modo privado, bloqueado) a dica aparece sempre e fechar vale só para esta visita.
 */
const STORAGE_KEY = "beeznoo.tips.dismissed";
const listeners = new Set<() => void>();
let cache: string | null | undefined;

function read(): string {
  if (cache !== undefined && cache !== null) return cache;
  try {
    cache = localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    cache = "[]";
  }
  return cache;
}

function dismissedIds(): string[] {
  try {
    const v = JSON.parse(read());
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function setDismissed(id: string, dismissed: boolean) {
  const ids = new Set(dismissedIds());
  if (dismissed) ids.add(id);
  else ids.delete(id);
  // guarda no máximo 50 ids (os mais recentes): os estados da reserva vão-se acumulando
  cache = JSON.stringify([...ids].slice(-50));
  try {
    localStorage.setItem(STORAGE_KEY, cache);
  } catch {
    /* sem storage: fica só em memória nesta visita */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = undefined;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Estado da dica `id`. No servidor (e na hidratação) é "unknown": não se desenha nada para não piscar. */
function useTipState(id: string): "open" | "closed" | "unknown" {
  return useSyncExternalStore(
    subscribe,
    () => (dismissedIds().includes(id) ? "closed" : "open"),
    () => "unknown",
  );
}

export function Tip({
  id, title, steps, children, className, eyebrow,
}: {
  id: string;
  title: string;
  /** Passos curtos e numerados (2–4). */
  steps?: string[];
  /** Texto livre (em vez de, ou depois dos passos). */
  children?: React.ReactNode;
  className?: string;
  /** Por omissão "Como funciona". */
  eyebrow?: string;
}) {
  const state = useTipState(`tip.${id}`);
  // reaberto pelo link depois de fechado (só nesta visita)
  const [reopened, setReopened] = useState(false);
  const titleId = useId();
  const t = useT().tips;

  if (state === "unknown") return null;
  if (state === "closed" && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start text-sm font-medium text-mel-texto hover:underline",
          className,
        )}
      >
        <CircleHelp className="size-4" strokeWidth={1.8} aria-hidden />
        {t.howItWorksQ}
      </button>
    );
  }

  const close = () => {
    setReopened(false);
    setDismissed(`tip.${id}`, true);
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn("relative grid animate-sobe gap-3 rounded-cartao border border-salvia/50 bg-salvia-tint p-4 pr-14 text-verde md:p-5 md:pr-16", className)}
    >
      <button
        type="button"
        onClick={close}
        aria-label={t.hide}
        title={t.hide}
        className="absolute top-1.5 right-1.5 flex size-11 cursor-pointer items-center justify-center rounded-full text-verde-medio transition-colors duration-200 hover:bg-branco/60"
      >
        <X className="size-5" strokeWidth={1.8} aria-hidden />
      </button>
      <div className="flex items-center gap-3">
        <HexTile icon={Lightbulb} tone="salvia" size={36} />
        <div className="grid min-w-0 gap-0.5">
          <p className="text-xs font-bold tracking-[0.1em] text-verde-medio uppercase">{eyebrow ?? t.howItWorks}</p>
          <h2 id={titleId} className="font-titulo text-lg leading-tight font-bold text-verde">{title}</h2>
        </div>
      </div>
      {steps && steps.length > 0 && (
        <ol className="grid gap-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-[15px] leading-snug">
              <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-branco text-[13px] font-bold text-verde-medio" aria-hidden>
                {i + 1}
              </span>
              <span className="pt-px">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {children && <div className="text-[15px] leading-snug">{children}</div>}
      <button
        type="button"
        onClick={close}
        className="inline-flex min-h-11 cursor-pointer items-center justify-self-start rounded-campo px-1 text-sm font-bold text-verde-medio hover:underline"
      >
        {t.gotIt}
      </button>
    </section>
  );
}
