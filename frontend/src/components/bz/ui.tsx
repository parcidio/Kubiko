import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Botões ────────────────────────────────────────────────────────────────
// primary = âmbar (um por ecrã) · dark = verde · outline = secundário · ghost · danger · soft (areia-2)
type Variant = "primary" | "dark" | "outline" | "ghost" | "danger" | "soft" | "light";
type Size = "md" | "sm" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-chart-2 text-verde hover:bg-ambar-hover",
  dark: "bg-verde text-areia hover:bg-verde-medio",
  outline: "border border-border-bg bg-branco text-verde hover:bg-areia-2",
  ghost: "text-verde hover:bg-areia-2",
  danger: "border border-erro bg-branco text-erro hover:bg-erro-tint",
  soft: "bg-areia-2 text-verde hover:bg-skeleton",
  light: "bg-areia text-verde hover:bg-branco",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-[15px]",
  lg: "min-h-14 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-sm font-bold whitespace-nowrap cursor-pointer transition",
    "active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

type ButtonProps = React.ComponentProps<"button"> & { variant?: Variant; size?: Size; block?: boolean; loading?: boolean };

export function Button({ variant, size, block, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClass(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean };

export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClass(variant, size, block), className)} {...rest} />;
}

export function IconButton({ label, icon: Icon, className, ...rest }: React.ComponentProps<"button"> & { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full text-current transition hover:bg-black/5 active:scale-95", className)}
      {...rest}
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

// ── Badges ────────────────────────────────────────────────────────────────
export type Tone = "pendente" | "analise" | "ok" | "erro" | "neutro" | "escuro";

const TONE: Record<Tone, string> = {
  pendente: "bg-ambar-tint text-aviso-texto",
  analise: "bg-areia-2 text-verde",
  ok: "bg-salvia-tint text-verde-medio",
  erro: "bg-erro-tint text-erro",
  neutro: "bg-areia-2 text-cinza",
  escuro: "bg-verde text-areia",
};

export function Badge({ tone = "neutro", icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-bold tracking-[0.08em] whitespace-nowrap uppercase", TONE[tone], className)}>
      {Icon && <Icon className="size-3.5" strokeWidth={2.2} aria-hidden />}
      {children}
    </span>
  );
}

// ── Callout (alerta) ──────────────────────────────────────────────────────
type CalloutTone = "info" | "warn" | "ok" | "erro" | "dark";

const CALLOUT: Record<CalloutTone, string> = {
  info: "bg-areia-2 text-verde",
  warn: "bg-ambar-tint text-aviso-texto",
  ok: "bg-salvia-tint text-verde [&_svg]:text-verde-medio",
  erro: "bg-erro-tint text-erro",
  dark: "bg-verde text-areia [&_svg]:text-ambar",
};

export function Callout({
  tone = "info", icon: Icon, title, children, action, className, role,
}: { tone?: CalloutTone; icon?: LucideIcon; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string; role?: string }) {
  return (
    <div role={role} className={cn("flex gap-3 rounded-cartao p-4 text-sm leading-5", CALLOUT[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden />}
      <div className="grid flex-1 gap-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// ── Cartões e estrutura ───────────────────────────────────────────────────
export function Card({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-cartao border border-borda bg-branco", className)} {...rest} />;
}

export function Skeleton({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton-brilho rounded-campo", className)} {...rest} />;
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <h2 className="font-titulo text-lg font-bold text-verde">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold tracking-[0.1em] text-cinza uppercase", className)}>{children}</p>;
}

/** Montante em Kz com número em destaque: <Kz value={25000} /> → 25.000 Kz */
export function Kz({ value, className, unitClassName }: { value: number | null | undefined; className?: string; unitClassName?: string }) {
  const n = Math.round(Number(value ?? 0)).toLocaleString("de-DE");
  return (
    <span className={cn("num font-titulo font-extrabold tracking-tight whitespace-nowrap", className)}>
      {n}
      <span className={cn("ml-1 text-[0.6em] font-bold", unitClassName)}>Kz</span>
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-mel-texto hover:underline">
      <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
      {children}
    </Link>
  );
}

/** Linha chave → valor com ícone (local, datas, dono…). */
export function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-borda py-3 last:border-0">
      <Icon className="mt-0.5 size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
      <div className="grid min-w-0 gap-0.5">
        <span className="text-[13px] text-cinza">{label}</span>
        <span className="font-medium text-verde">{children}</span>
      </div>
    </div>
  );
}
