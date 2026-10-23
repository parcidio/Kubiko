import { AlertCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({
  icon: Icon, title, text, action,
}: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-bz-md border border-borda bg-branco px-6 py-12 text-center">
      <Icon className="size-8 text-mel" strokeWidth={1.8} aria-hidden />
      <h2 className="font-heading text-lg text-verde">{title}</h2>
      <p className="max-w-sm text-[15px] text-cinza">{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-bz-md border border-borda bg-branco px-6 py-12 text-center">
      <AlertCircle className="size-8 text-erro" strokeWidth={1.8} aria-hidden />
      <p className="max-w-sm text-[15px] text-texto-corpo">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Tentar outra vez
      </Button>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="A carregar" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-bz-md border border-borda bg-branco">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="grid gap-2 p-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="A carregar" className="grid gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-bz-md border border-borda bg-branco p-3">
          <Skeleton className="size-20 shrink-0" />
          <div className="grid flex-1 content-start gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
