"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronRight, CircleHelp, LogOut, Package, ShieldCheck, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { HexGlow } from "@/components/bz/brand";
import { ModeSwitch } from "@/components/bz/shell";
import { BackendPending } from "@/components/bz/states";
import { Card, Eyebrow } from "@/components/bz/ui";
import { signOut, useRequireSession } from "@/lib/auth";
import { whatsappLink } from "@/lib/booking";
import { canOwn, canRent, isAdmin } from "@/lib/mode";
import type { UserRole } from "@/lib/types";

const ROLE_LABEL: Record<UserRole, string> = {
  RENTER: "Arrendatário",
  OWNER: "Dono de equipamento",
  BOTH: "Alugo e sou dono",
  ADMIN: "Equipa Beeznoo",
};

export default function ContaPage() {
  const session = useRequireSession();
  const router = useRouter();
  if (!session) return null;

  const links: { href: string; label: string; icon: LucideIcon; show: boolean; external?: boolean }[] = [
    { href: "/verificacao", label: "Verificação de identidade", icon: BadgeCheck, show: true },
    { href: "/reservas", label: "As minhas reservas", icon: Ticket, show: canRent(session.role) },
    { href: "/equipamentos", label: "O meu equipamento", icon: Package, show: canOwn(session.role) },
    { href: "/carteira", label: "Carteira", icon: Wallet, show: true },
    { href: "/admin", label: "Painel da equipa", icon: ShieldCheck, show: isAdmin(session.role) },
    { href: whatsappLink("Olá Beeznoo! Preciso de ajuda com a minha conta."), label: "Ajuda no WhatsApp", icon: CircleHelp, show: true, external: true },
  ];

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <section className="relative overflow-hidden rounded-sheet bg-verde-noite p-6 text-areia">
        <HexGlow />
        <div className="relative grid gap-4">
          <Eyebrow className="text-salvia">A tua conta</Eyebrow>
          <p className="font-titulo text-3xl font-extrabold">{ROLE_LABEL[session.role]}</p>
          <ModeSwitch dark className="justify-self-start" />
        </div>
      </section>

      <BackendPending what="Nome, telefone e estado de verificação do perfil precisam de GET /profiles/me (e PATCH para editar)." />

      <Card className="overflow-hidden">
        {links
          .filter((l) => l.show)
          .map(({ href, label, icon: Icon, external }) => (
            <Link
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              className="flex min-h-14 items-center gap-3 border-b border-borda px-4 font-medium text-verde last:border-0 hover:bg-areia"
            >
              <Icon className="size-5 text-mel" strokeWidth={1.8} aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-5 text-cinza" strokeWidth={1.8} aria-hidden />
            </Link>
          ))}
      </Card>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/entrar");
        }}
        className="flex min-h-14 items-center justify-center gap-2 rounded-cartao border border-borda bg-branco font-bold text-erro hover:bg-erro-tint"
      >
        <LogOut className="size-5" strokeWidth={1.8} aria-hidden /> Sair
      </button>
    </div>
  );
}
