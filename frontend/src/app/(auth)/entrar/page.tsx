"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthTitle, Divider, GoogleButton } from "@/components/bz/auth";
import { FormError, PasswordField, PhoneField, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { Segmented } from "@/components/bz/tabs";
import { Button } from "@/components/bz/ui";
import { authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { readSession } from "@/lib/session";

function LoginForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (mode === "phone" && !isValidPhone(phone)) fields.phone = "Escreve os 9 dígitos do teu número.";
    if (mode === "email" && !/^\S+@\S+\.\S+$/.test(email)) fields.email = "Escreve um email válido.";
    if (!password) fields.password = "Escreve a tua password.";
    if (Object.keys(fields).length) return setErrors({ fields });

    setLoading(true);
    setErrors({ fields: {} });
    try {
      signIn(await authApi.login(mode === "phone" ? { phone: normalizePhone(phone), password } : { email: email.trim(), password }));
      // Sem ?next, cada papel começa no seu ecrã
      const role = readSession()?.role;
      const home = role === "ADMIN" ? "/admin" : role === "OWNER" ? "/painel" : "/explorar";
      router.replace(safeNext(nextParam, home));
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthTitle title="Olá outra vez" subtitle="Entra para pedir reservas, pagar e acompanhar tudo num sítio." />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Segmented
          label="Entrar com"
          value={mode}
          onChange={setMode}
          options={[
            { value: "phone", label: "Telefone" },
            { value: "email", label: "Email" },
          ]}
        />
        {mode === "phone" ? (
          <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        ) : (
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.fields.email} />
        )}
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
