"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AuthTitle, Divider, FormError, GoogleButton, ResendCode, RolePicker, toFormErrors, type SignupRole,
} from "@/components/beeznoo/auth-ui";
import { OtpField, PasswordField, PhoneField, TextField } from "@/components/beeznoo/fields";
import { authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";

type Errors = { form?: string; fields: Record<string, string> };

function RegisterFlow() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<"data" | "otp">("data");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("RENTER");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({ fields: {} });
  const [loading, setLoading] = useState(false);

  const payload = () => ({
    fullName: fullName.trim(),
    phone: normalizePhone(phone),
    email: email.trim() || undefined,
    password,
    role,
  });

  async function submitData(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (fullName.trim().length < 3) fields.fullName = "Escreve o teu nome completo.";
    if (!isValidPhone(phone)) fields.phone = "Escreve os 9 dígitos do teu número.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) fields.email = "Escreve um email válido ou deixa em branco.";
    if (password.length < 8) fields.password = "A password tem de ter pelo menos 8 caracteres.";
    if (Object.keys(fields).length) return setErrors({ fields });

    setLoading(true);
    setErrors({ fields: {} });
    try {
      await authApi.register(payload());
      setStep("otp");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setErrors({ fields: { code: "O código tem 6 dígitos." } });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      signIn(await authApi.verifyRegistration({ phone: normalizePhone(phone), code }));
      toast.success("Conta criada. Bem-vindo ao Beeznoo.");
      router.replace(next);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <>
        <AuthTitle
          title="Confirma o teu número"
          subtitle={<>Enviámos um código por SMS para <strong className="text-verde">{normalizePhone(phone)}</strong>.</>}
        />
        <form onSubmit={submitOtp} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <FormError message={errors.form} />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "A confirmar…" : "Confirmar e criar conta"}
          </Button>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCode(""); setStep("data"); }}>
              Mudar número
            </Button>
            <ResendCode
              onResend={async () => {
                try {
                  await authApi.register(payload());
                  toast.success("Novo código enviado.");
                } catch (err) {
                  setErrors(toFormErrors(err));
                }
              }}
            />
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Criar conta" subtitle="Leva menos de um minuto. Confirmamos o teu número por SMS." />
      <form onSubmit={submitData} className="grid gap-5" noValidate>
        <TextField label="Nome completo" autoComplete="name" value={fullName} onChange={setFullName} error={errors.fields.fullName} />
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <TextField
          label="Email (opcional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.fields.email}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Pelo menos 8 caracteres."
          error={errors.fields.password}
        />
        <RolePicker value={role} onChange={setRole} />
        <FormError message={errors.form} />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "A enviar código…" : "Continuar"}
        </Button>
        <Divider />
        <GoogleButton label="Registar com Google" />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        Já tens conta?{" "}
        <Link href="/entrar" className="font-medium text-mel-texto hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function RegistarPage() {
  return (
    <Suspense>
      <RegisterFlow />
    </Suspense>
  );
}
