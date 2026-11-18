import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SuccessCheck (v4): círculo `salvia-tint` que entra com `--ease-pop` (600 ms) e um check que aparece a seguir.
 * Para "Pedido enviado", "Pagamento confirmado". Com reduced-motion aparece logo no estado final.
 * Decorativo por omissão (o título ao lado diz o que aconteceu); passa `label` se estiver sozinho.
 */
export function SuccessCheck({ size = 88, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 animate-check-pop items-center justify-center rounded-full bg-salvia-tint text-verde-medio", className)}
      style={{ width: size, height: size }}
    >
      <Check className="animate-check-in" style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={2.4} aria-hidden />
    </span>
  );
}
