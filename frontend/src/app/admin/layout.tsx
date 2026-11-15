"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Banknote, Flag, LayoutDashboard, LogOut, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/bz/brand";
import { ErrorState } from "@/components/bz/states";
import { ButtonLink } from "@/components/bz/ui";
import { signOut, useRequireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/mode";
import { cn } from "@/lib/utils";

const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/verificacoes", label: "Verificações", icon: BadgeCheck },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: Banknote },
  { href: "/admin/caucoes", label: "Cauções", icon: ShieldCheck },
  { href: "/admin/problemas", label: "Problemas", icon: Flag },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
];

/** Admin é desktop-first (1280px), com versão mínima no telemóvel para urgências. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireSession();
  const pathname = usePathname();

  if (!session) return null;
  if (!isAdmin(session.role)) {
    return (
      <div className="app grid min-h-dvh place-items-center p-4">
        <div className="grid justify-items-center gap-2">
          <ErrorState message="Esta área é só para a equipa Beeznoo." />
          <ButtonLink href="/explorar" variant="outline">Voltar à app</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="app min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 bg-verde text-areia md:h-dvh">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Logo dark href="/admin" />
          <span className="rounded-full bg-ambar px-2 py-0.5 text-[11px] font-bold tracking-wider text-verde uppercase">Equipa</span>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] md:grid md:gap-1 md:px-3">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-3 rounded-campo px-3 text-sm font-medium whitespace-nowrap transition",
                  active ? "bg-areia text-verde" : "text-areia/80 hover:bg-white/10 hover:text-areia",
                )}
              >
                <Icon className={cn("size-5", active ? "text-mel" : "text-ambar")} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            );
          })}
          <SignOutButton />
        </nav>
      </aside>
      <main className="px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

/** Terminar sessão: revoga o refresh no servidor e limpa a sessão local (como em Conta). */
function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/entrar");
      }}
      className="flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-campo px-3 text-sm font-medium whitespace-nowrap text-areia/80 transition hover:bg-white/10 hover:text-areia disabled:opacity-60 md:mt-4 md:border-t md:border-white/10 md:pt-4"
    >
      <LogOut className="size-5 text-ambar" strokeWidth={1.8} aria-hidden />
      {busy ? "A sair…" : "Sair"}
    </button>
  );
}
