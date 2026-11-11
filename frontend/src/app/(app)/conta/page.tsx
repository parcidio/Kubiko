"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, CheckCircle2, ChevronRight, CircleHelp, Clock, LogOut, Mail, Moon, Package, Phone, ShieldCheck, Sun, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { HexGlow } from "@/components/bz/brand";
import { FormError, OtpField, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { ModeSwitch } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { Button, Callout, Card, Eyebrow, Skeleton } from "@/components/bz/ui";
import { authApi, profileApi } from "@/lib/api";
import { signOut, useRequireSession } from "@/lib/auth";
import { initials, whatsappLink } from "@/lib/booking";
import { canOwn, canRent, isAdmin } from "@/lib/mode";
import type { Me, UserRole } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const ROLE_LABEL: Record<UserRole, string> = {
  RENTER: "Arrendatário",
  OWNER: "Dono de equipamento",
  BOTH: "Alugo e sou dono",
  ADMIN: "Equipa Beeznoo",
};

/** Regresso de "Associar conta Google" (/conta?google=…). */
const GOOGLE_RESULT: Record<string, { tone: "ok" | "warn"; title: string; text: string }> = {
  linked: { tone: "ok", title: "Conta Google associada", text: "Já podes entrar com o Google. Se o email era o mesmo, ficou verificado." },
  already: { tone: "warn", title: "Já tens outra conta Google associada", text: "Fala connosco no WhatsApp se a quiseres trocar." },
  conflict: { tone: "warn", title: "Essa conta Google pertence a outro perfil", text: "Entra com essa conta Google para a usar, ou escolhe outra conta Google." },
};

function subscribeTheme(onChange: () => void) {
  window.addEventListener("beeznoo:theme", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("beeznoo:theme", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getThemeSnapshot() {
  return window.localStorage.getItem("beeznoo.theme") === "dark";
}

function ContaInner() {
  const session = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const darkMode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => false);
  const me = useResource<Me>(session ? "profile:me" : null, () => profileApi.me());
  const googleResult = GOOGLE_RESULT[params.get("google") ?? ""];

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
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
          <span className="flex size-28 items-center justify-center rounded-full border-4 border-ambar/70 bg-verde font-titulo text-4xl font-extrabold text-ambar shadow-flutua md:size-32" aria-hidden>
            {me.data ? initials(me.data.fullName) : ROLE_LABEL[session.role].charAt(0)}
          </span>
          <div className="grid w-full gap-4">
            <div>
              <Eyebrow className="text-salvia">{ROLE_LABEL[session.role]}</Eyebrow>
              {me.data ? (
                <p className="mt-1 font-titulo text-3xl font-extrabold">{me.data.fullName}</p>
              ) : (
                <Skeleton className="mt-2 h-8 w-48 bg-white/10" />
              )}
            </div>
            {me.data && (
              <ul className="grid gap-2 rounded-cartao bg-white/10 p-4 text-left text-sm">
                <Status icon={Phone} label={me.data.phone} ok={me.data.phoneVerified} okText="confirmado" noText="por confirmar" />
                {me.data.email && <Status icon={Mail} label={me.data.email} ok={me.data.emailVerified} okText="verificado" noText="por verificar" />}
                <Status icon={BadgeCheck} label="Identidade" ok={me.data.identityVerified} okText="verificada" noText={me.data.kycStatus ? "em análise" : "por verificar"} />
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-7">
        {googleResult && (
          <Callout tone={googleResult.tone} title={googleResult.title}>
            {googleResult.text}
          </Callout>
        )}

        {me.error ? (
          <Card><ErrorState message={me.error} onRetry={me.reload} /></Card>
        ) : !me.data ? (
          <Skeleton role="status" aria-label="A carregar" className="h-72 rounded-cartao" />
        ) : (
          <>
            <ProfileForm me={me.data} onSaved={me.setData} />
            <EmailVerification me={me.data} onVerified={me.setData} />
            <GoogleSection me={me.data} />
          </>
        )}

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
                onClick={() => {
                  window.localStorage.setItem("beeznoo.theme", darkMode ? "light" : "dark");
                  window.dispatchEvent(new Event("beeznoo:theme"));
                }}
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

export default function ContaPage() {
  return (
    <Suspense>
      <ContaInner />
    </Suspense>
  );
}

function Status({ icon: Icon, label, ok, okText, noText }: { icon: LucideIcon; label: string; ok: boolean; okText: string; noText: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-salvia" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${ok ? "text-salvia" : "text-ambar"}`}>
        {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
        {ok ? okText : noText}
      </span>
    </li>
  );
}

function ProfileForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [fullName, setFullName] = useState(me.fullName);
  const [email, setEmail] = useState(me.email ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const dirty = fullName !== me.fullName || email.trim().toLowerCase() !== (me.email ?? "") || city !== (me.city ?? "");

  async function save() {
    setBusy(true);
    setErrors({ fields: {} });
    try {
      const updated = await profileApi.update({ fullName: fullName.trim(), email: email.trim(), city: city.trim() });
      onSaved(updated);
      toast.success(updated.email !== me.email && updated.email ? "Guardado. Verifica o email novo." : "Dados guardados.");
    } catch (e) {
      setErrors(toFormErrors(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">Dados pessoais</h2>
      <Card className="grid gap-4 p-4">
        <TextField label="Nome" value={fullName} onChange={setFullName} error={errors.fields.fullName} autoComplete="name" />
        <TextField
          label="Email (opcional)"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.fields.email}
          autoComplete="email"
          hint="Mudar o email anula a verificação. Deixa vazio para remover."
        />
        <TextField label="Bairro ou cidade" value={city} onChange={setCity} error={errors.fields.city} placeholder="Ex.: Talatona" />
        <p className="text-[13px] text-cinza">O telefone ({me.phone}) muda-se só com a equipa, porque é com ele que entras.</p>
        <FormError message={errors.form} />
        <Button variant="dark" disabled={!dirty || !fullName.trim()} loading={busy} onClick={save} className="justify-self-start">
          Guardar
        </Button>
      </Card>
    </section>
  );
}

function EmailVerification({ me, onVerified }: { me: Me; onVerified: (me: Me) => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!me.email || me.emailVerified) return null;

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await profileApi.requestEmailCode();
      setSent(true);
      toast.success(`Enviámos um código para ${me.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      onVerified(await profileApi.confirmEmail(code));
      toast.success("Email verificado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">Verificar email</h2>
      <Card className="grid gap-4 p-4">
        <p className="text-texto-corpo">
          Com o email verificado podes recuperar a conta por email. Se o teu email for do Gmail, associar a conta Google (abaixo) também o verifica.
        </p>
        {sent ? (
          <>
            <OtpField value={code} onChange={setCode} length={6} error={error} />
            <div className="flex flex-wrap gap-2">
              <Button variant="dark" disabled={code.length !== 6} loading={busy} onClick={confirm}>
                Confirmar código
              </Button>
              <Button variant="ghost" disabled={busy} onClick={send}>
                Enviar outro
              </Button>
            </div>
          </>
        ) : (
          <>
            {error && <Callout tone="warn">{error}</Callout>}
            <Button variant="outline" loading={busy} onClick={send} className="justify-self-start">
              <Mail strokeWidth={1.8} /> Enviar código para {me.email}
            </Button>
          </>
        )}
      </Card>
    </section>
  );
}

function GoogleSection({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    try {
      await authApi.linkGoogle(); // navega para o Google
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível começar a associação.");
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">Entrar com Google</h2>
      <Card className="grid gap-3 p-4">
        {me.googleLinked ? (
          <p className="flex items-center gap-2 text-verde">
            <CheckCircle2 className="size-5 text-verde-medio" strokeWidth={1.8} aria-hidden />
            A tua conta Google está associada: podes entrar com ela.
          </p>
        ) : (
          <>
            <p className="text-texto-corpo">
              Associa a tua conta Google para entrares com um toque. Vais ao Google confirmar e voltas aqui.
            </p>
            <Button variant="outline" loading={busy} onClick={link} className="justify-self-start">
              Associar conta Google
            </Button>
          </>
        )}
      </Card>
    </section>
  );
}
