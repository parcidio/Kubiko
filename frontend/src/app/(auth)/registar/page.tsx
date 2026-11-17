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
import { useT } from "@/lib/i18n/client";

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
  const dict = useT();
  const a = dict.auth;
  const t = a.register;

  const payload = () => ({ fullName: fullName.trim(), phone: normalizePhone(phone), email: email.trim() || undefined, password, role });

  async function submitData(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (fullName.trim().length < 3) fields.fullName = t.errName;
    if (!isValidPhone(phone)) fields.phone = a.phoneDigits;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) fields.email = t.errEmail;
    if (password.length < 8) fields.password = a.passwordMin;
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
    if (code.length !== 6) return setErrors({ fields: { code: a.codeLength } });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      signIn(await authApi.verifyRegistration({ phone: normalizePhone(phone), code }));
      toast.success(a.created);
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
        <StepProgress step={2} total={2} label={t.stepOtp} />
        <div className="h-6" />
        <AuthTitle
          title={a.otpTitle}
          subtitle={<>{a.otpSentBefore}<strong className="num text-verde">{normalizePhone(phone)}</strong>{a.otpSentAfter}</>}
        />
        <form onSubmit={submitOtp} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <FormError message={errors.form} />
          <Button type="submit" loading={loading} block size="lg">
            {loading ? a.confirming : t.otpSubmit}
          </Button>
          <div className="flex items-center justify-between">
            <button type="button" className="min-h-11 text-sm font-medium text-verde hover:underline" onClick={() => { setCode(""); setStep("data"); }}>
              {t.changeNumber}
            </button>
            <ResendCode
              onResend={async () => {
                try {
                  await authApi.register(payload());
                  toast.success(t.newCode);
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
      <StepProgress step={1} total={2} label={t.stepData} />
      <div className="h-6" />
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <form onSubmit={submitData} className="grid gap-5" noValidate>
        <TextField label={t.fullName} autoComplete="name" value={fullName} onChange={setFullName} error={errors.fields.fullName} />
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} autoComplete="username" />
        <TextField label={t.emailOpt} type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.fields.email} />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint={a.passwordHint} error={errors.fields.password} />
        <RolePicker value={role} onChange={setRole} />
        <FormError message={errors.form} />
        <p className="text-[13px] text-cinza">
          {t.acceptBefore}{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-mel-texto underline">
            {t.privacy}
          </Link>
          .
        </p>
        <Button type="submit" loading={loading} block size="lg">
          {loading ? a.sendingCode : dict.common.continue}
        </Button>
        <Divider />
        <GoogleButton label={a.googleSignUp} />
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        {t.haveAccount}{" "}
        <Link href="/entrar" className="font-bold text-mel-texto hover:underline">
          {t.signIn}
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
