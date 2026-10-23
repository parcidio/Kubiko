import { CloudOff, Construction, RotateCw, type LucideIcon } from "lucide-react";
import { HexIllustration } from "./brand";
import { Button, Skeleton } from "./ui";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon, title, text, action, tone = "areia", className,
}: { icon: LucideIcon; title: string; text?: React.ReactNode; action?: React.ReactNode; tone?: "areia" | "ok" | "ambar"; className?: string }) {
  return (
    <div className={cn("flex animate-sobe flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <HexIllustration icon={icon} tone={tone} />
      <h2 className="mt-2 font-titulo text-xl font-bold text-verde">{title}</h2>
      {text && <p className="max-w-sm text-cinza">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <HexIllustration icon={CloudOff} tone="erro" />
      <h2 className="mt-2 font-titulo text-xl font-bold text-verde">Não conseguimos carregar</h2>
      <p className="max-w-sm text-cinza">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-3">
          <RotateCw strokeWidth={1.8} /> Tentar outra vez
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 3, label = "A carregar" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-3">
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

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="A carregar equipamento" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
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
  return (
    <div className={cn("flex gap-3 rounded-cartao border border-dashed border-mel/60 bg-ambar-tint/60 p-4 text-sm text-aviso-texto", className)}>
      <Construction className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <p>
        <strong className="font-bold">Falta backend.</strong> {what} Por agora nada disto é guardado.
      </p>
    </div>
  );
}
