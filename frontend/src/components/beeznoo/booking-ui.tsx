import { Check, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKz, SERVICE_FEE_RATE } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

/** Foto 4:3 do equipamento; sem foto → bloco areia-2 com ícone. */
export function ItemPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-areia-2", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos vêm de storage externo
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package className="size-8 text-mel" strokeWidth={1.8} aria-hidden />
        </div>
      )}
    </div>
  );
}

export function PriceSummary({
  pricePerDay, days, deposit,
}: { pricePerDay: number; days: number; deposit: number }) {
  const subtotal = pricePerDay * days;
  const fee = Math.round(subtotal * SERVICE_FEE_RATE);
  const rows: [string, string][] = [
    [`${formatKz(pricePerDay)} × ${days} ${days === 1 ? "dia" : "dias"}`, formatKz(subtotal)],
    ["Taxa de serviço (8%)", formatKz(fee)],
    ["Caução reembolsável", formatKz(deposit)],
  ];
  return (
    <dl className="grid gap-2 text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-texto-corpo">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-borda pt-3">
        <dt className="font-medium text-verde">Total</dt>
        <dd className="font-heading text-[22px] text-verde">{formatKz(subtotal + fee + deposit)}</dd>
      </div>
      <p className="text-[13px] text-cinza">A caução é devolvida depois da inspeção do equipamento.</p>
    </dl>
  );
}

const STEPS = ["Pedido", "Aceite", "Pago", "Entregue", "Devolvido", "Caução libertada"];

// Os estados atuais do backend ainda não distinguem entregue/devolvido (checklists por fazer).
function reachedStep(status: BookingStatus) {
  switch (status) {
    case "PENDING_OWNER": return 0;
    case "ACCEPTED": return 1;
    case "ACTIVE":
    case "DISPUTED": return 2;
    case "COMPLETED": return 5;
    default: return -1;
  }
}

export function Timeline({ status }: { status: BookingStatus }) {
  const reached = reachedStep(status);
  return (
    <ol className="grid gap-0">
      {STEPS.map((label, i) => {
        const done = i <= reached;
        const current = i === reached + 1;
        return (
          <li key={label} className="relative flex items-start gap-3 pb-5 last:pb-0">
            {i < STEPS.length - 1 && (
              <span className={cn("absolute top-7 left-[13px] h-[calc(100%-24px)] w-0.5", done ? "bg-verde-medio" : "bg-borda")} aria-hidden />
            )}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                done ? "border-verde-medio bg-verde-medio text-branco" : current ? "border-ambar bg-ambar-tint" : "border-borda bg-branco",
              )}
              aria-hidden
            >
              {done && <Check className="size-4" strokeWidth={2.4} />}
            </span>
            <span className={cn("pt-1 text-[15px]", done ? "font-medium text-verde" : "text-cinza")}>
              {label}
              <span className="sr-only">{done ? " — feito" : current ? " — próximo passo" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra fixa de CTA no telemóvel (única sombra do sistema). */
export function StickyCTABar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-borda bg-branco px-4 py-3 shadow-cta md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      {children}
    </div>
  );
}
