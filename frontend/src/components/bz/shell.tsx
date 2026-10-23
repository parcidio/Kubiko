"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, CircleUserRound, Compass, Inbox, LayoutDashboard, LogIn, Package, Plus, ShieldCheck, Ticket, WifiOff, type LucideIcon,
} from "lucide-react";
import { Logo } from "./brand";
import { ButtonLink } from "./ui";
import { useSession } from "@/lib/auth";
import { canOwn, canRent, isAdmin, setMode, useMode, type Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const RENTER_NAV: NavItem[] = [
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/reservas", label: "Reservas", icon: Ticket },
  { href: "/atividade", label: "Atividade", icon: Bell },
  { href: "/conta", label: "Conta", icon: CircleUserRound },
];

const OWNER_NAV: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/pedidos", label: "Pedidos", icon: Inbox },
  { href: "/equipamentos", label: "Equipamento", icon: Package },
  { href: "/conta", label: "Conta", icon: CircleUserRound },
];

const GUEST_NAV: NavItem[] = [
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/reservas", label: "Reservas", icon: Ticket },
  { href: "/entrar", label: "Entrar", icon: LogIn },
];

function useNav() {
  const session = useSession();
  const mode = useMode(session?.role);
  if (!session) return { nav: GUEST_NAV, mode, session };
  return { nav: mode === "owner" ? OWNER_NAV : RENTER_NAV, mode, session };
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "A alugar" / "Sou dono" — só aparece a quem pode as duas coisas. */
export function ModeSwitch({ dark, className }: { dark?: boolean; className?: string }) {
  const session = useSession();
  const mode = useMode(session?.role);
  const router = useRouter();
  if (!session || !(canRent(session.role) && canOwn(session.role))) return null;
  const go = (m: Mode) => {
    setMode(m);
    router.push(m === "owner" ? "/painel" : "/explorar");
  };
  return (
    <div role="group" aria-label="Modo" className={cn("grid grid-cols-2 gap-1 rounded-full p-1", dark ? "bg-white/10" : "bg-areia-2", className)}>
      {(["renter", "owner"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => go(m)}
          className={cn(
            "min-h-9 rounded-full px-3 text-[13px] font-bold transition",
            mode === m ? (dark ? "bg-ambar text-verde" : "bg-verde text-areia") : dark ? "text-areia/80" : "text-verde",
          )}
        >
          {m === "renter" ? "A alugar" : "Sou dono"}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { nav, mode, session } = useNav();
  return (
    <header className="sticky top-0 z-40 border-b border-borda/70 bg-areia/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-12">
        <Logo href={session && mode === "owner" ? "/painel" : "/explorar"} />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Principal">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-[15px] font-medium transition",
                isActive(pathname, href) ? "bg-verde text-areia" : "text-texto-corpo hover:bg-areia-2",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ModeSwitch className="hidden md:grid" />
          {session && isAdmin(session.role) && (
            <ButtonLink href="/admin" variant="soft" size="sm" className="hidden md:inline-flex">
              <ShieldCheck strokeWidth={1.8} /> Admin
            </ButtonLink>
          )}
          {session && mode === "owner" && (
            <ButtonLink href="/publicar" variant="dark" size="sm" className="hidden md:inline-flex">
              <Plus strokeWidth={2} /> Publicar
            </ButtonLink>
          )}
          {session === null && (
            <ButtonLink href={`/entrar?next=${encodeURIComponent(pathname)}`} variant="outline" size="sm">
              Entrar
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { nav, mode, session } = useNav();
  const withPublish = !!session && mode === "owner";
  const items: (NavItem | "publish")[] = withPublish ? [nav[0], nav[1], "publish", nav[2], nav[3]] : nav;
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid h-[68px] border-t border-borda bg-branco/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden",
        items.length === 5 ? "grid-cols-5" : items.length === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {items.map((item) => {
        if (item === "publish") {
          return (
            <Link key="publish" href="/publicar" aria-label="Publicar equipamento" className="flex items-center justify-center">
              <span className="-mt-7 flex size-14 items-center justify-center bg-verde text-ambar shadow-flutua transition active:scale-95 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]">
                <Plus className="size-6" strokeWidth={2.4} aria-hidden />
              </span>
            </Link>
          );
        }
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex flex-col items-center justify-center gap-1 text-xs", active ? "font-bold text-verde" : "text-cinza")}
          >
            {active && <span className="absolute top-0 h-1 w-8 rounded-b-full bg-ambar" aria-hidden />}
            <Icon className="size-6" strokeWidth={active ? 2 : 1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-16 z-30 flex items-center justify-center gap-2 bg-verde px-4 py-2 text-[13px] text-areia">
      <WifiOff className="size-4 text-ambar" strokeWidth={1.8} aria-hidden />
      Sem ligação. Vamos tentar outra vez quando a rede voltar.
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app min-h-dvh">
      <TopBar />
      <OfflineBanner />
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-40 md:px-12 md:pt-8 md:pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

/** Barra fixa do CTA no telemóvel (por cima da BottomNav); no desktop fica no fluxo normal. */
export function StickyCTA({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 flex items-center gap-3 border-t border-borda bg-branco px-4 py-3 shadow-cta md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      {aside && <div className="min-w-0 flex-1 md:hidden">{aside}</div>}
      <div className={cn(aside ? "shrink-0 md:w-full" : "w-full")}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title, subtitle, action, back,
}: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-2">
      {back}
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-titulo text-[28px] leading-tight font-bold tracking-tight text-verde md:text-[36px]">{title}</h1>
          {subtitle && <p className="text-cinza">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
