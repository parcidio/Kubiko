"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Banknote, Flag, LayoutDashboard, LogOut, Map as MapIcon, MapPinned, MessageSquareText, ScrollText, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/bz/brand";
import { PageTransition } from "@/components/bz/motion";
import { PreferencesMenu } from "@/components/bz/preferences";
import { ErrorState } from "@/components/bz/states";
import { ButtonLink } from "@/components/bz/ui";
import { refreshSession } from "@/lib/api";
import { signOut, useRequireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/mode";
import { cn } from "@/lib/utils";

const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/verificacoes", label: "Verificações", icon: BadgeCheck },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: Banknote },
  { href: "/admin/caucoes", label: "Cauções", icon: ShieldCheck },
  { href: "/admin/problemas", label: "Problemas", icon: Flag },
  { href: "/admin/utilizadores", label: "Utilizadores", icon: Users },
  { href: "/admin/mensagens", label: "Mensagens", icon: MessageSquareText },
  { href: "/admin/zonas", label: "Zonas", icon: MapPinned },
  { href: "/admin/mapa", label: "Mapa", icon: MapIcon },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
];

/** Admin é desktop-first (1280px), com versão mínima no telemóvel para urgências. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useRequireSession();
  const pathname = usePathname();
  // O papel vem do token (15 min). Quem acabou de receber acesso de admin ainda tem um token antigo e, nesta área,
  // nenhum pedido falha com 401 para o renovar: renova uma vez antes de recusar. Se a promoção revogou a sessão,
  // a renovação falha, a sessão local é limpa e useRequireSession leva a pessoa a entrar outra vez (com 2FA).
  const [checked, setChecked] = useState(false);
  const tried = useRef(false);
  const needsCheck = !!session && !isAdmin(session.role) && !checked;
  useEffect(() => {
    if (!needsCheck || tried.current) return;
    tried.current = true;
    refreshSession().finally(() => setChecked(true));
  }, [needsCheck]);

  if (!session) return null;
  if (needsCheck) return <div role="status" aria-label="A carregar" className="app min-h-dvh" />;
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
      <aside className="superficie-marca sticky top-0 z-30 bg-verde text-areia md:h-dvh">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Logo dark href="/admin" />
          <span className="rounded-full bg-salvia px-2.5 py-0.5 text-xs font-bold tracking-[0.08em] text-verde uppercase">Equipa</span>
          {/* Tema e língua (o mesmo controlo da app): o painel abre para a direita, sobre o conteúdo */}
          <PreferencesMenu dark align="start" className="ml-auto" />
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
                  "flex min-h-11 shrink-0 items-center gap-3 rounded-campo px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                  active ? "bg-areia font-bold text-verde" : "text-salvia-tint hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className={cn("size-5", active ? "text-verde-medio" : "text-salvia")} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            );
          })}
          <SignOutButton />
        </nav>
      </aside>
      <main className="px-4 py-6 md:px-10 md:py-10"><PageTransition>{children}</PageTransition></main>
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
      className="flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-campo px-3 text-sm font-medium whitespace-nowrap text-salvia-tint transition-colors duration-200 hover:bg-white/10 hover:text-white disabled:opacity-60 md:mt-4 md:border-t md:border-white/10 md:pt-4"
    >
      <LogOut className="size-5 text-salvia" strokeWidth={1.8} aria-hidden />
      {busy ? "A sair…" : "Sair"}
    </button>
  );
}
