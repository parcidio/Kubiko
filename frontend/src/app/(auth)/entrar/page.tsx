"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminMfaStep, AuthTitle, Divider, GoogleButton } from "@/components/bz/auth";
import { FormError, OtpField, PasswordField, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { Button } from "@/components/bz/ui";
import { ApiError, authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { readSession } from "@/lib/session";

/** Login com o telefone por confirmar: pede o código enviado pela API (e o número, se entrou com email). */
function PhoneConfirmStep({ initialPhone, onDone }: { initialPhone: string; onDone: () => void }) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);
  const a = useT().auth;
  const t = a.phoneConfirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (!isValidPhone(phone.trim())) fields.phone = t.errPhone;
    if (code.length !== 6) fields.code = a.codeLength;
    if (Object.keys(fields).length) return setErrors({ fields });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      signIn(await authApi.verifyRegistration({ phone: normalizePhone(phone.trim()), code }));
      onDone();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        {!initialPhone && (
          <TextField
            label={t.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={setPhone}
            error={errors.fields.phone}
          />
        )}
        <OtpField value={code} onChange={setCode} error={errors.fields.code ?? (initialPhone ? errors.fields.phone : undefined)} />
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? a.confirming : t.submit}
        </Button>
      </form>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  // Um só campo "Telefone ou email" (autocomplete=username): com dois campos a alternar, o gestor de passwords
  // gravava ora o número ora o email e preenchia o campo errado (o de telefone cortava tudo o que não fosse dígito)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);
  const [mfa, setMfa] = useState<{ token: string; hint?: string | null } | null>(null);
  // Telefone por confirmar (registo a meio, ou a equipa repôs a confirmação): a API enviou um código novo
  const [phoneConfirm, setPhoneConfirm] = useState<{ phone: string } | null>(null);
  const a = useT().auth;
  const t = a.login;

  function goHome() {
    // Sem ?next, cada papel começa no seu ecrã
    const role = readSession()?.role;
    const home = role === "ADMIN" ? "/admin" : role === "OWNER" ? "/painel" : "/explorar";
    router.replace(safeNext(nextParam, home));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    const id = identifier.trim();
    const isEmail = id.includes("@");
    if (!id) fields.identifier = t.errEmpty;
    else if (isEmail && !/^\S+@\S+\.\S+$/.test(id)) fields.identifier = t.errEmail;
    else if (!isEmail && !isValidPhone(id)) fields.identifier = t.errPhone;
    if (!password) fields.password = t.errPassword;
    if (Object.keys(fields).length) return setErrors({ fields });

    setLoading(true);
    setErrors({ fields: {} });
    try {
      const res = await authApi.login(isEmail ? { email: id, password } : { phone: normalizePhone(id), password });
      if (res.mfaRequired && res.mfaToken) {
        setMfa({ token: res.mfaToken, hint: res.mfaPhoneHint });
        return;
      }
      signIn(res);
      goHome();
    } catch (err) {
      if (err instanceof ApiError && err.code === "phone_unverified") {
        setPhoneConfirm({ phone: isEmail ? "" : id });
        return;
      }
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (phoneConfirm) return <PhoneConfirmStep initialPhone={phoneConfirm.phone} onDone={goHome} />;
  if (mfa) return <AdminMfaStep mfaToken={mfa.token} phoneHint={mfa.hint} onDone={goHome} />;

  return (
    <>
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <TextField
          label={t.identifier}
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t.identifierPh}
          value={identifier}
          onChange={setIdentifier}
          error={errors.fields.identifier}
        />
        <div className="grid gap-1">
          <PasswordField value={password} onChange={setPassword} error={errors.fields.password} />
          <Link href="/recuperar" className="flex min-h-11 items-center justify-self-end text-sm font-medium text-mel-texto hover:underline">
            {t.forgot}
          </Link>
        </div>
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? a.signingIn : t.submit}
        </Button>
        <Divider />
        <GoogleButton />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        {t.noAccount}{" "}
        <Link href={`/registar${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`} className="font-bold text-mel-texto hover:underline">
          {t.signUp}
        </Link>
      </p>
    </>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
