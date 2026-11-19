import { CloudOff, Construction, RotateCw, type LucideIcon } from "lucide-react";
import { HexTile, type HexTone } from "./hex";
import { Button, Skeleton } from "./ui";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// Só importado por client components (usa useT). Num server component passa os textos já traduzidos.

const EMPTY_TONE: Record<"areia" | "ok" | "ambar", HexTone> = { areia: "areia", ok: "salvia-tint", ambar: "ambar-tint" };

/** Estado vazio v4: hexágono areia-2 com ícone + título + frase + uma ação. */
export function EmptyState({
  icon, title, text, action, tone = "areia", className,
}: { icon: LucideIcon; title: string; text?: React.ReactNode; action?: React.ReactNode; tone?: "areia" | "ok" | "ambar"; className?: string }) {
  return (
    <div className={cn("flex animate-sobe flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <HexTile icon={icon} tone={EMPTY_TONE[tone]} size={72} />
      <h2 className="mt-2 font-titulo text-xl font-bold text-verde">{title}</h2>
      {text && <p className="max-w-sm text-cinza">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Estado vazio "colmeia" (v4, Reservas e Atividade): favo de fundo a desvanecer e um cacho de hexágonos —
 * o ícone principal (ambar-tint) e dois satélites (verde e âmbar, decorativos). Vive dentro de um cartão.
 */
export function HiveEmptyState({
  icon, satellites, title, text, action, className,
}: {
  icon: LucideIcon;
  satellites: [LucideIcon, LucideIcon];
  title: string;
  text?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const [Dark, Amber] = satellites;
  return (
    <div className={cn("relative animate-sobe overflow-hidden px-6 pt-12 pb-14 text-center md:pt-16", className)}>
      <div className="hex-bg absolute inset-x-0 top-0 h-64 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="relative mx-auto mb-6 h-40 w-48" aria-hidden>
        <HexTile icon={icon} size={112} tone="ambar-tint" className="absolute top-3 left-1/2 -translate-x-1/2 text-mel" />
        <HexTile icon={Dark} size={52} tone="verde" className="absolute top-0 right-1 text-white" />
        <HexTile icon={Amber} size={44} className="absolute bottom-3 left-2 bg-ambar text-sobre-ambar" />
        <HexTile size={20} tone="areia" className="absolute right-6 bottom-0 bg-borda" />
      </div>
      <h2 className="relative font-titulo text-xl font-bold text-verde md:text-2xl">{title}</h2>
      {text && <p className="relative mx-auto mt-2 max-w-sm text-cinza">{text}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

/** Estado de erro: hexágono erro + mensagem + "Tentar outra vez". */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  const t = useT();
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <HexTile icon={CloudOff} tone="erro" size={72} />
      <h2 className="mt-2 font-titulo text-xl font-bold text-verde">{t.states.errorTitle}</h2>
      <p className="max-w-sm text-cinza">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          <RotateCw strokeWidth={1.8} /> {t.common.retry}
        </Button>
      )}
    </div>
  );
}

/** Lista a carregar (linhas com foto), role="status". */
export function ListSkeleton({ rows = 3, label }: { rows?: number; label?: string }) {
  const t = useT();
  return (
    <div role="status" aria-label={label ?? t.common.loading} className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-cartao border border-borda bg-branco p-3">
          <Skeleton className="size-20 shrink-0 rounded-campo" />
          <div className="grid flex-1 content-center gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grelha de equipamento a carregar (fotos 4:3), role="status". */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  const t = useT();
  return (
    <div role="status" aria-label={t.states.loadingItems} className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] md:gap-4 lg:gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="aspect-[4/3] rounded-cartao" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Aviso honesto para ecrãs (ou partes) sem endpoint no backend.
 * `what` descreve o que falta; a lista completa está em docs/BACKEND_GAPS.md.
 */
export function BackendPending({ what, className }: { what: string; className?: string }) {
  const t = useT().states;
  return (
    <div className={cn("flex gap-3 rounded-cartao border border-dashed border-mel/60 bg-ambar-tint/60 p-4 text-sm text-aviso-texto", className)}>
      <Construction className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <p>
        <strong className="font-bold">{t.backendPending}</strong> {what} {t.backendPendingAfter}
      </p>
    </div>
  );
}
