"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, CheckCircle2, ChevronRight, CircleHelp, Clock, Languages, LogOut, Mail, Package, Phone, ShieldCheck, SunMoon, Ticket, Wallet, type LucideIcon } from "lucide-react";
import { HexGlow } from "@/components/bz/brand";
import { FormError, OtpField, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { HexTile } from "@/components/bz/hex";
import { KycCard } from "@/components/bz/kyc";
import { toast } from "@/components/bz/overlay";
import { ModeSwitch } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { Button, Callout, Card, Eyebrow, Skeleton } from "@/components/bz/ui";
import { authApi, profileApi } from "@/lib/api";
import { signOut, useRequireSession } from "@/lib/auth";
import { whatsappLink } from "@/lib/booking";
import { AvatarEditor } from "@/components/bz/avatar";
import { canOwn, canRent, isAdmin } from "@/lib/mode";
import type { Me, UserRole } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { LangSwitch } from "@/components/bz/lang-switch";
import { ThemeSwitch } from "@/components/bz/preferences";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

/** Regresso de "Associar conta Google" (/conta?google=…); textos em t.account.google. */
const GOOGLE_TONE: Record<string, "ok" | "warn"> = { linked: "ok", already: "warn", conflict: "warn" };

function ContaInner() {
  const session = useRequireSession();
  const router = useRouter();
  const params = useSearchParams();
  const me = useResource<Me>(session ? "profile:me" : null, () => profileApi.me());
  const dict = useT();
  const t = dict.account;
  const ROLE_LABEL: Record<UserRole, string> = t.roles;
  const googleKey = params.get("google") ?? "";
  const googleResult = googleKey in GOOGLE_TONE ? { tone: GOOGLE_TONE[googleKey], ...t.google[googleKey as keyof typeof t.google] } : undefined;

  if (!session) return null;

  const links: { href: string; label: string; icon: LucideIcon; show: boolean; external?: boolean }[] = [
    { href: "/verificacao", label: t.links.verification, icon: BadgeCheck, show: true },
    { href: "/reservas", label: t.links.bookings, icon: Ticket, show: canRent(session.role) },
    { href: "/equipamentos", label: t.links.equipment, icon: Package, show: canOwn(session.role) },
    { href: "/carteira", label: t.links.wallet, icon: Wallet, show: true },
    { href: "/admin", label: t.links.admin, icon: ShieldCheck, show: isAdmin(session.role) },
    { href: whatsappLink(t.helpText), label: t.links.help, icon: CircleHelp, show: true, external: true },
  ];

  return (
    <div className="mx-0 grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 md:gap-8 lg:-ml-12 lg:w-[calc(100%+3rem)] lg:grid-cols-[minmax(24rem,0.9fr)_minmax(34rem,1.1fr)] lg:items-start xl:grid-cols-[minmax(28rem,0.9fr)_minmax(40rem,1.1fr)]">
      <section className="superficie-marca relative overflow-hidden rounded-sheet bg-verde-noite p-5 text-areia md:p-8">
        <HexGlow />
        <div className="relative grid justify-items-center gap-4 text-center md:gap-5 lg:justify-items-start lg:text-left">
          {me.data ? (
            <AvatarEditor me={me.data} onChange={me.setData} />
          ) : (
            <>
              <HexTile tone="salvia" size={80} className="num md:hidden">{ROLE_LABEL[session.role].charAt(0)}</HexTile>
              <HexTile tone="salvia" size={104} className="num hidden md:inline-flex">{ROLE_LABEL[session.role].charAt(0)}</HexTile>
            </>
          )}
          <div className="grid w-full gap-4">
            <div>
              <Eyebrow className="text-salvia">{ROLE_LABEL[session.role]}</Eyebrow>
              {me.data ? (
                <p className="mt-1 font-titulo text-[26px] leading-tight font-bold text-white md:text-[32px]">{me.data.fullName}</p>
              ) : (
                <Skeleton className="mt-2 h-8 w-48 bg-white/10" />
              )}
            </div>
            {me.data && (
              <ul className="grid gap-2.5 rounded-cartao border border-white/10 bg-white/5 p-3.5 text-left md:gap-2 md:p-4 text-sm text-salvia-tint">
                <Status icon={Phone} label={me.data.phone} ok={me.data.phoneVerified} okText={t.confirmed} noText={t.toConfirm} />
                {me.data.email && <Status icon={Mail} label={me.data.email} ok={me.data.emailVerified} okText={t.verifiedM} noText={t.toVerify} />}
                <Status icon={BadgeCheck} label={t.identity} ok={me.data.identityVerified} okText={t.verifiedF} noText={me.data.kycStatus === "PENDING" || me.data.kycStatus === "IN_REVIEW" ? t.inReview : me.data.kycStatus === "REJECTED" ? t.rejected : me.data.kycStatus === "INFO_REQUESTED" ? t.infoNeeded : t.toVerify} />
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 md:gap-7">
        {googleResult && (
          <Callout tone={googleResult.tone} title={googleResult.title}>
            {googleResult.text}
          </Callout>
        )}

        {me.error ? (
          <Card><ErrorState message={me.error} onRetry={me.reload} /></Card>
        ) : !me.data ? (
          <Skeleton role="status" aria-label={dict.common.loading} className="h-72 rounded-cartao" />
        ) : (
          <>
            <KycCard context="account" />
            <ProfileForm me={me.data} onSaved={me.setData} />
            <EmailVerification me={me.data} onVerified={me.setData} />
            <GoogleSection me={me.data} />
          </>
        )}

        <section className="grid gap-3 md:gap-4">
          <h2 className="font-titulo text-xl font-bold text-verde">{t.about}</h2>
          <Card className="overflow-hidden">
            {links
              .filter((l) => l.show)
              .map(({ href, label, icon: Icon, external }) => (
                <Link
                  key={label}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className="group flex min-h-14 items-center gap-3 border-b border-borda px-4 py-2 font-medium text-verde transition-colors duration-200 last:border-0 hover:bg-areia"
                >
                  <HexTile icon={Icon} tone="areia" size={34} />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="size-5 text-cinza transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.8} aria-hidden />
                </Link>
              ))}
          </Card>
        </section>

        <section className="grid gap-3 md:gap-4">
          <h2 className="font-titulo text-xl font-bold text-verde">{t.appearance}</h2>
          <Card className="grid gap-4 p-4">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div><p className="font-bold text-verde">{t.mode}</p><p className="text-sm text-cinza">{t.modeText}</p></div>
              <ModeSwitch className="w-full sm:w-auto" />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-borda pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <Languages className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                <div><p className="font-bold text-verde">{t.language}</p><p className="text-sm text-cinza">{t.languageText}</p></div>
              </div>
              <LangSwitch />
            </div>
            <div className="flex flex-col items-stretch gap-3 border-t border-borda pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <SunMoon className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                <div><p className="font-bold text-verde">{t.theme}</p><p className="text-sm text-cinza">{t.themeText}</p></div>
              </div>
              <ThemeSwitch className="w-full sm:w-auto" />
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
          <LogOut className="size-5" strokeWidth={1.8} aria-hidden /> {t.signOut}
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
      <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${ok ? "bg-salvia/15 text-salvia" : "bg-white/10 text-salvia-tint"}`}>
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
  const t = useT().account;
  const dirty = fullName !== me.fullName || email.trim().toLowerCase() !== (me.email ?? "") || city !== (me.city ?? "");

  async function save() {
    setBusy(true);
    setErrors({ fields: {} });
    try {
      const updated = await profileApi.update({ fullName: fullName.trim(), email: email.trim(), city: city.trim() });
      onSaved(updated);
      toast.success(updated.email !== me.email && updated.email ? t.savedVerify : t.saved);
    } catch (e) {
      setErrors(toFormErrors(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 md:gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">{t.personal}</h2>
      <Card className="grid gap-4 p-4">
        <TextField label={t.name} value={fullName} onChange={setFullName} error={errors.fields.fullName} autoComplete="name" />
        <TextField
          label={t.email}
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.fields.email}
          autoComplete="email"
          hint={t.emailHint}
        />
        <TextField label={t.city} value={city} onChange={setCity} error={errors.fields.city} placeholder={t.cityPh} />
        <p className="text-[13px] text-cinza">{fmt(t.phoneNote, { phone: me.phone })}</p>
        <FormError message={errors.form} />
        <Button variant="dark" disabled={!dirty || !fullName.trim()} loading={busy} onClick={save} className="w-full sm:w-auto sm:justify-self-start">
          {t.save}
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
  const t = useT().account;
  if (!me.email || me.emailVerified) return null;

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await profileApi.requestEmailCode();
      setSent(true);
      toast.success(fmt(t.codeSent, { email: me.email ?? "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.codeSendError);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      onVerified(await profileApi.confirmEmail(code));
      toast.success(t.emailVerified);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 md:gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">{t.verifyEmail}</h2>
      <Card className="grid gap-4 p-4">
        <p className="text-texto-corpo">
          {t.verifyEmailText}
        </p>
        {sent ? (
          <>
            <OtpField value={code} onChange={setCode} length={6} error={error} />
            <div className="flex flex-wrap gap-2">
              <Button variant="dark" disabled={code.length !== 6} loading={busy} onClick={confirm}>
                {t.confirmCode}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={send}>
                {t.sendAnother}
              </Button>
            </div>
          </>
        ) : (
          <>
            {error && <Callout tone="warn">{error}</Callout>}
            <Button variant="outline" loading={busy} onClick={send} className="w-full sm:w-auto sm:justify-self-start">
              <Mail strokeWidth={1.8} /> {fmt(t.sendCodeTo, { email: me.email })}
            </Button>
          </>
        )}
      </Card>
    </section>
  );
}

function GoogleSection({ me }: { me: Me }) {
  const [busy, setBusy] = useState(false);
  const t = useT().account;

  async function link() {
    setBusy(true);
    try {
      await authApi.linkGoogle(); // navega para o Google
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.linkError);
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 md:gap-4">
      <h2 className="font-titulo text-xl font-bold text-verde">{t.googleTitle}</h2>
      <Card className="grid gap-3 p-4">
        {me.googleLinked ? (
          <p className="flex items-center gap-2 text-verde">
            <CheckCircle2 className="size-5 text-verde-medio" strokeWidth={1.8} aria-hidden />
            {t.googleLinked}
          </p>
        ) : (
          <>
            <p className="text-texto-corpo">
              {t.googleText}
            </p>
            <Button variant="outline" loading={busy} onClick={link} className="w-full sm:w-auto sm:justify-self-start">
              {t.googleLink}
            </Button>
          </>
        )}
      </Card>
    </section>
  );
}
