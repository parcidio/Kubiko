"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminMfaStep, AuthTitle, Divider, GoogleButton } from "@/components/bz/auth";
import { FormError, PasswordField, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { Button } from "@/components/bz/ui";
import { authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { readSession } from "@/lib/session";

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
    if (!id) fields.identifier = "Escreve o teu telefone ou email.";
    else if (isEmail && !/^\S+@\S+\.\S+$/.test(id)) fields.identifier = "Escreve um email válido.";
    else if (!isEmail && !isValidPhone(id)) fields.identifier = "Escreve os 9 dígitos do teu número (ou o teu email).";
    if (!password) fields.password = "Escreve a tua password.";
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
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (mfa) return <AdminMfaStep mfaToken={mfa.token} phoneHint={mfa.hint} onDone={goHome} />;

  return (
    <>
      <AuthTitle title="Olá outra vez" subtitle="Entra para pedir reservas, pagar e acompanhar tudo num sítio." />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <TextField
          label="Telefone ou email"
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="923 456 789 ou nome@email.com"
          value={identifier}
          onChange={setIdentifier}
          error={errors.fields.identifier}
        />
        <div className="grid gap-1">
          <PasswordField value={password} onChange={setPassword} error={errors.fields.password} />
          <Link href="/recuperar" className="flex min-h-11 items-center justify-self-end text-sm font-medium text-mel-texto hover:underline">
            Esqueceste a password?
          </Link>
        </div>
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? "A entrar…" : "Entrar"}
        </Button>
        <Divider />
        <GoogleButton />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        Ainda não tens conta?{" "}
        <Link href={`/registar${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`} className="font-bold text-mel-texto hover:underline">
          Criar conta
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
