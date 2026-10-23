"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet/modal com <dialog> nativo: foco preso, Esc e backdrop de graça.
 * Telemóvel: sobe de baixo (bottom sheet). Desktop: modal centrado.
 */
export function Sheet({
  open, onClose, title, children, footer, className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "app m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-sheet bg-branco p-0 text-texto-corpo shadow-flutua open:animate-sheet",
        "md:m-auto md:max-w-lg md:rounded-sheet md:open:animate-sobe",
        className,
      )}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center gap-3 px-5 pt-3 pb-2">
          <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-borda-forte md:hidden" />
          <h2 id={titleId} className="mt-3 flex-1 font-titulo text-xl font-bold text-verde">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="mt-3 flex size-11 items-center justify-center rounded-full hover:bg-areia-2">
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-borda bg-branco px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

// ── Toasts (substitui o sonner) ───────────────────────────────────────────
type ToastKind = "ok" | "erro" | "info";
type ToastItem = { id: number; kind: ToastKind; text: string };

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  listeners.forEach((l) => l());
}

function push(kind: ToastKind, text: string) {
  const id = ++seq;
  items = [...items, { id, kind, text }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export const toast = Object.assign((text: string) => push("info", text), {
  success: (text: string) => push("ok", text),
  error: (text: string) => push("erro", text),
});

const ICON = { ok: CheckCircle2, erro: AlertCircle, info: Info };

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {list.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "erro" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm animate-sobe items-center gap-3 rounded-cartao bg-verde px-4 py-3 font-corpo text-[15px] text-areia shadow-flutua"
          >
            <Icon className={cn("size-5 shrink-0", t.kind === "erro" ? "text-[#F4A29C]" : "text-ambar")} strokeWidth={1.8} aria-hidden />
            <p>{t.text}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Copia para a área de transferência e confirma com um toast. */
export async function copyText(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copiad${what.endsWith("a") ? "a" : "o"}.`);
  } catch {
    toast.error("Não foi possível copiar. Seleciona e copia à mão.");
  }
}
