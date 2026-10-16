"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthTitle, FormError, ResendCode, RolePicker, toFormErrors, type SignupRole } from "@/components/beeznoo/auth-ui";
import { OtpField, PhoneField } from "@/components/beeznoo/fields";
import { authApi } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";

type Errors = { form?: string; fields: Record<string, string> };

/** Destino do redirect do backend após o OAuth2 Google (OAuth2SuccessHandler). */
function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || status !== "success") return;
    handled.current = true;
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    if (accessToken && refreshToken) {
      signIn({ accessToken, refreshToken, expiresIn: Number(params.get("expiresIn") ?? 0) });
      // replace remove os tokens do histórico do browser
      router.replace("/explorar");
    }
  }, [status, params, router]);

  if (status === "pending_phone") return <CompletePhone pendingToken={params.get("pendingToken") ?? ""} />;

  if (status === "success") return <p role="status" className="text-[15px] text-cinza">A entrar…</p>;

  return (
    <>
      <AuthTitle title="Não foi possível entrar com Google" subtitle="Tenta outra vez ou entra com o teu número." />
      <Button asChild className="w-full">
        <Link href="/entrar">Voltar a entrar</Link>
      </Button>
    </>
  );
}

function CompletePhone({ pendingToken }: { pendingToken: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SignupRole>("RENTER");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({ fields: {} });
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    await authApi.googleRegister({ pendingToken, phone: normalizePhone(phone), role });
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErrors({ fields: { phone: "Escreve os 9 dígitos do teu número." } });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      await sendCode();
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
      signIn(await authApi.googleVerify({ pendingToken, code }));
      toast.success("Conta criada. Bem-vindo ao Beeznoo.");
      router.replace("/explorar");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <>
        <AuthTitle title="Confirma o teu número" subtitle={<>Enviámos um código por SMS para <strong className="text-verde">{normalizePhone(phone)}</strong>.</>} />
        <form onSubmit={submitOtp} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <FormError message={errors.form} />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "A confirmar…" : "Confirmar"}
          </Button>
          <div className="flex justify-end">
            <ResendCode onResend={() => sendCode().catch((err) => setErrors(toFormErrors(err)))} />
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Falta o teu número" subtitle="Usamos o telefone para confirmar reservas e falar contigo." />
      <form onSubmit={submitPhone} className="grid gap-5" noValidate>
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <RolePicker value={role} onChange={setRole} />
        <FormError message={errors.form} />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "A enviar código…" : "Continuar"}
        </Button>
      </form>
    </>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
