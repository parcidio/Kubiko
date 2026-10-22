"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthTitle, Divider, FormError, GoogleButton, toFormErrors } from "@/components/beeznoo/auth-ui";
import { PasswordField, PhoneField, TextField } from "@/components/beeznoo/fields";
import { authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ form?: string; fields: Record<string, string> }>({ fields: {} });
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
      const res = await authApi.login(
        mode === "phone" ? { phone: normalizePhone(phone), password } : { email: email.trim(), password },
      );
      signIn(res);
      router.replace(next);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthTitle title="Entrar" subtitle="Aluga equipamento de quem está perto de ti, em Luanda." />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "phone" | "email")}>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-bz-sm bg-areia-2 p-1">
            <TabsTrigger value="phone" className="rounded-bz-sm text-[15px] data-[state=active]:bg-branco data-[state=active]:text-verde">
              Telefone
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-bz-sm text-[15px] data-[state=active]:bg-branco data-[state=active]:text-verde">
              Email
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "phone" ? (
          <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        ) : (
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.fields.email} />
        )}
        <PasswordField value={password} onChange={setPassword} error={errors.fields.password} />
        <Link href="/recuperar" className="-mt-2 justify-self-end text-sm text-mel-texto hover:underline">
          Esqueceste a password?
        </Link>

        <FormError message={errors.form} />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "A entrar…" : "Entrar"}
        </Button>
        <Divider />
        <GoogleButton />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        Ainda não tens conta?{" "}
        <Link href={`/registar${next !== "/explorar" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-mel-texto hover:underline">
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
