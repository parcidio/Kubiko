"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronRight, CircleHelp, LogOut, Moon, Package, ShieldCheck, Sun, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { HexGlow } from "@/components/bz/brand";
import { ModeSwitch } from "@/components/bz/shell";
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
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => () => {
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  }, [avatarUrl]);
  useEffect(() => {
    setDarkMode(window.localStorage.getItem("beeznoo.theme") === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("beeznoo.theme", darkMode ? "dark" : "light");
  }, [darkMode]);
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
    <div className="mx-0 grid max-w-6xl gap-8 lg:-ml-12 lg:w-[calc(100%+3rem)] lg:grid-cols-[minmax(24rem,0.9fr)_minmax(34rem,1.1fr)] lg:items-start xl:grid-cols-[minmax(28rem,0.9fr)_minmax(40rem,1.1fr)]">
      <section className="relative overflow-hidden rounded-sheet bg-verde-noite p-6 text-areia md:p-8">
        <HexGlow />
        <div className="relative grid justify-items-center gap-5 text-center lg:justify-items-start lg:text-left">
          <label className="group relative flex size-32 cursor-pointer items-center justify-center justify-self-center overflow-hidden rounded-full border-4 border-ambar/70 bg-verde text-ambar shadow-flutua md:size-36" aria-label="Adicionar foto de perfil">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Foto de perfil" className="size-full object-cover" />
            ) : (
              <span className="font-titulo text-4xl font-extrabold">{ROLE_LABEL[session.role].charAt(0)}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-verde/85 py-2 text-center text-xs font-bold text-areia opacity-0 transition group-hover:opacity-100">Adicionar foto</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setAvatarUrl((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return URL.createObjectURL(file);
                });
              }}
            />
          </label>
          <div className="grid w-full gap-4">
            <div>
              <Eyebrow className="text-salvia">A tua conta</Eyebrow>
              <p className="mt-1 font-titulo text-3xl font-extrabold">{ROLE_LABEL[session.role]}</p>
            </div>
            <dl className="grid gap-3 rounded-cartao bg-white/10 p-4 text-left text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-areia/65">ID do perfil</dt><dd className="max-w-[12rem] truncate font-medium">{session.profileId}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-areia/65">Tipo de conta</dt><dd className="font-medium">{ROLE_LABEL[session.role]}</dd></div>
              <div className="border-t border-white/10 pt-3 text-xs text-areia/65">Nome, telefone e foto serão guardados quando o perfil estiver disponível.</div>
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-7">
        <section className="grid gap-4">
          <h2 className="font-titulo text-xl font-bold text-verde">Sobre a minha conta</h2>
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
        </section>

        <section className="grid gap-4">
          <h2 className="font-titulo text-xl font-bold text-verde">Aparência</h2>
          <Card className="grid gap-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div><p className="font-bold text-verde">Modo de utilização</p><p className="text-sm text-cinza">Escolhe como usas a Beeznoo.</p></div>
              <ModeSwitch />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-borda pt-4">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="size-5 text-mel" aria-hidden /> : <Sun className="size-5 text-mel" aria-hidden />}
                <div><p className="font-bold text-verde">Tema escuro</p><p className="text-sm text-cinza">Altera o contraste da aplicação.</p></div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                aria-label="Ativar tema escuro"
                onClick={() => setDarkMode((active) => !active)}
                className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full p-1 transition-colors ${darkMode ? "bg-primary" : "bg-borda"}`}
              >
                <span className={`block size-5 rounded-full bg-branco shadow transition-transform ${darkMode ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </Card>
        </section>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace("/entrar");
          }}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-cartao border border-borda bg-branco font-bold text-erro hover:bg-erro-tint"
        >
          <LogOut className="size-5" strokeWidth={1.8} aria-hidden /> Sair
        </button>
      </div>
    </div>
  );
}
