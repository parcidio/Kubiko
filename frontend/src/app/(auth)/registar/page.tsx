"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthTitle, Divider, GoogleButton, ResendCode, RolePicker, type SignupRole } from "@/components/bz/auth";
import { FormError, OtpField, PasswordField, PhoneField, StepProgress, TextField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { Button } from "@/components/bz/ui";
import { authApi } from "@/lib/api";
import { safeNext, signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";

function RegisterFlow() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const [step, setStep] = useState<"data" | "otp">("data");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("RENTER");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);

  const payload = () => ({ fullName: fullName.trim(), phone: normalizePhone(phone), email: email.trim() || undefined, password, role });

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
      toast.success("Conta criada. Bem-vindo à Beeznoo.");
      const home = role === "OWNER" ? "/painel" : "/explorar";
      router.replace(`/bem-vindo?next=${encodeURIComponent(safeNext(nextParam, home))}`);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <>
        <StepProgress step={2} total={2} label="Confirmar número" />
        <div className="h-6" />
        <AuthTitle
          title="Confirma o teu número"
          subtitle={<>Enviámos um código para <strong className="num text-verde">{normalizePhone(phone)}</strong>.</>}
        />
        <form onSubmit={submitOtp} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <FormError message={errors.form} />
          <Button type="submit" loading={loading} block size="lg">
            {loading ? "A confirmar…" : "Confirmar e criar conta"}
          </Button>
          <div className="flex items-center justify-between">
            <button type="button" className="min-h-11 text-sm font-medium text-verde hover:underline" onClick={() => { setCode(""); setStep("data"); }}>
              Mudar número
            </button>
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
      <StepProgress step={1} total={2} label="Os teus dados" />
      <div className="h-6" />
      <AuthTitle title="Cria a tua conta" subtitle="Menos de um minuto. Confirmamos o teu número com um código." />
      <form onSubmit={submitData} className="grid gap-5" noValidate>
        <TextField label="Nome completo" autoComplete="name" value={fullName} onChange={setFullName} error={errors.fields.fullName} />
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <TextField label="Email (opcional)" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.fields.email} />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint="Pelo menos 8 caracteres." error={errors.fields.password} />
        <RolePicker value={role} onChange={setRole} />
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? "A enviar código…" : "Continuar"}
        </Button>
        <Divider />
        <GoogleButton label="Registar com Google" />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        Já tens conta?{" "}
        <Link href="/entrar" className="font-bold text-mel-texto hover:underline">
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
