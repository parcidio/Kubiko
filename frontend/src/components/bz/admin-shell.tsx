"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck, Banknote, CalendarRange, ChevronDown, Flag, KeyRound, LayoutDashboard, LogOut, Map as MapIcon, MapPinned,
  Menu, MessageSquareText, ScrollText, ShieldCheck, UserCog, Users, X, type LucideIcon,
} from "lucide-react";
import { Logo } from "./brand";
import { PreferencesMenu } from "./preferences";
import { ADMIN_ROLE_LABEL, type MyAdminAccess } from "@/lib/api-admin";
import { signOut } from "@/lib/auth";
import type { AdminPermission } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Back-office (decisoes-produto.md 2026-11-18): barra lateral agrupada, barra de topo com o menu da pessoa.
 * As áreas escondem-se pela permissão do papel de equipa; quem decide é sempre a API.
 */

export type NavItem = { href: string; label: string; icon: LucideIcon; perm: AdminPermission };
export type NavGroup = { label: string | null; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  { label: null, items: [{ href: "/admin", label: "Visão geral", icon: LayoutDashboard, perm: "OVERVIEW" }] },
  {
    label: "Operação",
    items: [
      { href: "/admin/reservas", label: "Reservas", icon: CalendarRange, perm: "OPERATIONS_DESK" },
      { href: "/admin/pagamentos", label: "Pagamentos", icon: Banknote, perm: "OPERATIONS_DESK" },
      { href: "/admin/caucoes", label: "Cauções", icon: ShieldCheck, perm: "OPERATIONS_DESK" },
      { href: "/admin/problemas", label: "Problemas", icon: Flag, perm: "OPERATIONS_DESK" },
    ],
  },
  {
    label: "Confiança",
    items: [
      { href: "/admin/verificacoes", label: "Verificações", icon: BadgeCheck, perm: "KYC" },
      { href: "/admin/utilizadores", label: "Utilizadores", icon: Users, perm: "USERS_READ" },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { href: "/admin/mapa", label: "Mapa", icon: MapIcon, perm: "GROWTH_DESK" },
      { href: "/admin/zonas", label: "Zonas", icon: MapPinned, perm: "GROWTH_DESK" },
      { href: "/admin/mensagens", label: "Mensagens", icon: MessageSquareText, perm: "MESSAGES" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/equipa", label: "Equipa e acessos", icon: UserCog, perm: "TEAM" },
      { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, perm: "AUDIT" },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

/** Item da navegação que corresponde ao caminho (o mais específico). */
export function navItemFor(pathname: string) {
  return [...ALL_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`)));
}

// ── Acesso ────────────────────────────────────────────────────────────────

const AccessContext = createContext<MyAdminAccess | null>(null);

export function AdminAccessProvider({ value, children }: { value: MyAdminAccess; children: React.ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAdminAccess() {
  const access = useContext(AccessContext);
  return {
    access,
    can: (perm: AdminPermission) => !!access?.permissions.includes(perm),
  };
}

/** Mostra os filhos só com a permissão (ações dentro de uma página). */
export function Can({ perm, children }: { perm: AdminPermission; children: React.ReactNode }) {
  const { can } = useAdminAccess();
  return can(perm) ? <>{children}</> : null;
}

// ── Navegação ─────────────────────────────────────────────────────────────

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAdminAccess();
  const current = navItemFor(pathname)?.href;

  return (
    <nav aria-label="Admin" className="grid gap-5 px-3 py-4">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((i) => can(i.perm));
        if (items.length === 0) return null;
        const headingId = `nav-${group.label ?? "inicio"}`;
        return (
          <div key={group.label ?? "inicio"} className="grid gap-0.5" role="group" aria-labelledby={group.label ? headingId : undefined}>
            {group.label && (
              <p id={headingId} className="px-3 pb-1 text-xs font-bold tracking-[0.12em] text-cinza uppercase">
                {group.label}
              </p>
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === current;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 items-center gap-3 rounded-campo px-3 text-[15px] transition-colors duration-200",
                    active ? "bg-areia-2 font-bold text-verde" : "text-texto-corpo hover:bg-areia hover:text-verde",
                  )}
                >
                  {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-verde-medio" />}
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-verde-medio" : "text-cinza")} strokeWidth={1.8} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-borda bg-branco xl:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-borda px-5">
        <Logo href="/admin" />
        <span className="rounded-full bg-areia-2 px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] text-verde uppercase">Admin</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks />
      </div>
    </aside>
  );
}

/** Gaveta da navegação em ecrãs < 1024px (<dialog>: foco preso e Esc). */
function MobileNav() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu do Admin"
        className="inline-flex size-11 items-center justify-center rounded-campo text-verde hover:bg-areia-2 xl:hidden"
      >
        <Menu className="size-5" strokeWidth={1.8} aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-label="Menu do Admin"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="app m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-branco p-0 text-texto-corpo"
      >
        <div className="flex h-14 items-center justify-between border-b border-borda px-4">
          <Logo href="/admin" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="inline-flex size-11 items-center justify-center rounded-campo hover:bg-areia-2">
            <X className="size-5" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
      </dialog>
    </>
  );
}

/** Menu da pessoa: nome, papel, voltar à app, sair. Esc e clique fora fecham. */
function UserMenu() {
  const { access } = useAdminAccess();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const name = access?.fullName ?? "";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-campo px-2 hover:bg-areia-2"
      >
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-verde-solido text-xs font-bold text-white">{initials || "?"}</span>
        <span className="hidden text-left leading-tight sm:grid">
          <span className="max-w-40 truncate text-sm font-bold text-verde">{name}</span>
          <span className="text-xs text-cinza">{access?.adminRole ? ADMIN_ROLE_LABEL[access.adminRole] : "Sem papel"}</span>
        </span>
        <ChevronDown className="size-4 text-cinza" strokeWidth={1.8} aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" className="absolute right-0 z-40 mt-1 grid w-60 gap-0.5 rounded-campo border border-borda bg-branco p-1.5 shadow-sheet">
          <div className="px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-bold text-verde">{name}</p>
            <p className="text-xs text-cinza">{access?.adminRole ? ADMIN_ROLE_LABEL[access.adminRole] : "Sem papel"}</p>
          </div>
          <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-campo px-3 text-sm text-verde hover:bg-areia-2">
            <KeyRound className="size-4 text-cinza" strokeWidth={1.8} aria-hidden /> A minha conta
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
              router.replace("/entrar");
            }}
            className="flex min-h-10 items-center gap-2 rounded-campo px-3 text-left text-sm text-erro hover:bg-erro-tint disabled:opacity-60"
          >
            <LogOut className="size-4" strokeWidth={1.8} aria-hidden /> {busy ? "A sair…" : "Sair"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminTopBar() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-borda bg-branco px-3 md:px-6">
      <MobileNav />
      <div className="xl:hidden"><Logo href="/admin" /></div>
      <p className="hidden min-w-0 truncate text-sm text-cinza xl:block">
        {item?.group ? <>{item.group} <span aria-hidden>/</span> </> : null}
        <span className="font-bold text-verde">{item?.label ?? "Admin"}</span>
      </p>
      <div className="ml-auto flex items-center gap-1">
        {/* Tema e língua (o mesmo controlo da app) */}
        <PreferencesMenu />
        <UserMenu />
      </div>
    </header>
  );
}
