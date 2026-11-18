"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminMfaStep, AuthTitle, ResendCode, RolePicker, type SignupRole } from "@/components/bz/auth";
import { FormError, OtpField, PhoneField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { Button, ButtonLink } from "@/components/bz/ui";
import { authApi } from "@/lib/api";
import { signIn } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { isForeignPhone } from "@/lib/phone";
import { useT } from "@/lib/i18n/client";

type Errors = FormErrors;

/** Destino do redirect do backend após o OAuth2 Google (OAuth2SuccessHandler). */
function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status");
  const handled = useRef(false);

  // Lido no primeiro render: o replace abaixo tira o código da URL
  const [code] = useState(() => params.get("code"));
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const [mfa, setMfa] = useState<{ token: string; hint?: string | null } | null>(null);
  const failed = exchangeFailed || (status === "success" && !code);
  const a = useT().auth;
  const t = a.oauth;

  useEffect(() => {
    if (handled.current || status !== "success" || !code) return;
    handled.current = true;
    // replace já: o código sai do histórico do browser mesmo antes da troca
    router.replace("/oauth2/callback?status=success");
    authApi
      .googleExchange(code)
      .then((tokens) => {
        // conta ADMIN: falta o 2.º passo (código por WhatsApp ou SMS)
        if (tokens.mfaRequired && tokens.mfaToken) {
          setMfa({ token: tokens.mfaToken, hint: tokens.mfaPhoneHint });
          return;
        }
        signIn(tokens);
        router.replace("/explorar");
      })
      .catch(() => setExchangeFailed(true));
  }, [status, code, router]);

  if (mfa) return <AdminMfaStep mfaToken={mfa.token} phoneHint={mfa.hint} onDone={() => router.replace("/admin")} />;

  if (status === "pending_phone") return <CompletePhone pendingToken={params.get("pendingToken") ?? ""} />;

  if (status === "success" && !failed) return <p role="status" className="text-[15px] text-cinza">{a.signingIn}</p>;

  if (status === "email_in_use") {
    return (
      <>
        <AuthTitle
          title={t.emailInUseTitle}
          subtitle={t.emailInUseText}
        />
        <ButtonLink href="/entrar?next=%2Fconta" block>
          {t.signInPhone}
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <AuthTitle title={t.failedTitle} subtitle={t.failedText} />
      <ButtonLink href="/entrar" block>
        {t.backToLogin}
      </ButtonLink>
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
  const dict = useT();
  const a = dict.auth;

  async function sendCode() {
    await authApi.googleRegister({ pendingToken, phone: normalizePhone(phone), role });
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErrors({ fields: { phone: a.phoneDigits } });
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
    if (code.length !== 6) return setErrors({ fields: { code: a.codeLength } });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      signIn(await authApi.googleVerify({ pendingToken, code }));
      toast.success(a.created);
      router.replace(`/bem-vindo?next=${role === "OWNER" ? "/painel" : "/explorar"}`);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <>
        <AuthTitle title={a.otpTitle} subtitle={<>{a.otpSentBefore}<strong className="text-verde">{normalizePhone(phone)}</strong>{isForeignPhone(phone) ? a.otpSentAfterForeign : a.otpSentAfter}</>} />
        <form onSubmit={submitOtp} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <FormError message={errors.form} />
          <Button type="submit" loading={loading} block size="lg">
            {loading ? a.confirming : a.oauth.confirm}
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
      <AuthTitle title={a.oauth.phoneTitle} subtitle={a.oauth.phoneText} />
      <form onSubmit={submitPhone} className="grid gap-5" noValidate>
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <RolePicker value={role} onChange={setRole} />
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? a.sendingCode : dict.common.continue}
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
