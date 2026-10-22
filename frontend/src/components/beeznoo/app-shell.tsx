"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, LogOut, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/explorar", label: "Explorar", icon: Search },
  { href: "/reservas", label: "Reservas", icon: CalendarCheck },
];

export function AppHeader() {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-areia/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-12">
        <Link href="/explorar" aria-label="Beeznoo — início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/svg/beeznoo-lockup-horizontal-tinta.svg" alt="Beeznoo" className="h-7 w-auto" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-bz-sm px-3 py-2 text-[15px] text-texto-corpo hover:bg-areia-2",
                pathname.startsWith(href) && "font-medium text-verde",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {session ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.replace("/entrar");
            }}
          >
            <LogOut strokeWidth={1.8} /> Sair
          </Button>
        ) : session === null ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/entrar?next=${encodeURIComponent(pathname)}`}>
              <UserRound strokeWidth={1.8} /> Entrar
            </Link>
          </Button>
        ) : (
          <span className="w-20" />
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-2 border-t border-borda bg-branco md:hidden" aria-label="Principal">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs", active ? "font-medium text-verde" : "text-cinza")}
          >
            <Icon className={cn("size-6", active && "text-mel")} strokeWidth={1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
