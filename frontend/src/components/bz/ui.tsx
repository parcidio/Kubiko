import Link from "next/link";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Botões (DESIGN_SYSTEM v4 §8) ──────────────────────────────────────────
// v4: primary = âmbar com texto verde (um por ecrã) · secondary = contorno borda-forte · on-dark = contorno areia
// (fundos verdes) · ghost · danger. Variantes v3 mantidas: dark (verde cheio) · outline (= secondary) · soft · light.
type Variant = "primary" | "secondary" | "on-dark" | "dark" | "outline" | "ghost" | "danger" | "soft" | "light";
type Size = "md" | "sm" | "lg";

const SECONDARY = "border-[1.5px] border-borda-forte bg-branco text-verde hover:border-verde";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ambar text-sobre-ambar hover:bg-ambar-hover",
  secondary: SECONDARY,
  outline: SECONDARY,
  "on-dark": "border-[1.5px] border-areia/45 bg-transparent text-areia hover:border-areia hover:bg-areia/5",
  dark: "bg-verde text-areia hover:bg-verde-medio",
  ghost: "bg-transparent text-verde hover:bg-areia-2",
  danger: "border-[1.5px] border-erro bg-branco text-erro hover:bg-erro-tint",
  soft: "bg-areia-2 text-verde hover:bg-skeleton",
  light: "bg-areia text-verde hover:bg-branco",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-[15px]",
  lg: "min-h-[52px] px-6 text-base",
};

/** Classes de botão para <a>/<Link> que não usam <Button>/<ButtonLink>. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return cn(
    "group/btn inline-flex select-none items-center justify-center gap-2 rounded-campo font-bold whitespace-nowrap cursor-pointer",
    "transition-[background-color,border-color,color,transform] duration-200 ease-out",
    "active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

/** Seta que desliza 4px no hover do botão (prop `arrow`). */
function ButtonArrow() {
  return <ArrowRight className="seta-desliza" strokeWidth={1.8} aria-hidden />;
}

type ButtonProps = React.ComponentProps<"button"> & { variant?: Variant; size?: Size; block?: boolean; loading?: boolean; arrow?: boolean };

/** Botão v4: raio 12, altura 48 (lg = 52, formulário final); `arrow` acrescenta ArrowRight no fim. */
export function Button({ variant, size, block, loading, arrow, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClass(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
      {arrow && !loading && <ButtonArrow />}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean; arrow?: boolean };

/** Link com aspeto de botão (mesmas variantes do Button). */
export function ButtonLink({ variant, size, block, arrow, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClass(variant, size, block), className)} {...rest}>
      {children}
      {arrow && <ButtonArrow />}
    </Link>
  );
}

/** Botão só com ícone, 44px, com aria-label obrigatório. */
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

/** Roda de carregamento (decorativa; o estado vai em aria-busy). */
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

/** Pill de estado: ícone + texto em maiúsculas, tons em pares do DS. */
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

/** Alerta em bloco com ícone, título, texto e ação. */
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
/** Cartão: fundo branco, borda, raio 16, sem sombra. */
export function Card({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-cartao border border-borda bg-branco", className)} {...rest} />;
}

/** Bloco de carregamento com brilho (o pai leva role="status"). */
export function Skeleton({ className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton-brilho rounded-campo", className)} {...rest} />;
}

/** Título de secção (Bricolage) com ação opcional à direita. */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <h2 className="font-titulo text-lg font-bold text-verde">{children}</h2>
      {action}
    </div>
  );
}

/** Sobretítulo em maiúsculas (DM Sans 700, 12px). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold tracking-[0.12em] text-mel-texto uppercase", className)}>{children}</p>;
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

/** Link "voltar" com seta. */
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
