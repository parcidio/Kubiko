"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthTitle, ResendCode } from "@/components/bz/auth";
import { FormError, OtpField, PasswordField, PhoneField, toFormErrors, type FormErrors } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { Button } from "@/components/bz/ui";
import { authApi } from "@/lib/api";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export default function RecuperarPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);
  const dict = useT();
  const a = dict.auth;
  const t = a.recover;

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErrors({ fields: { phone: a.phoneDigits } });
    setLoading(true);
    setErrors({ fields: {} });
    try {
      await authApi.requestReset({ phone: normalizePhone(phone) });
      setStep("reset");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, string> = {};
    if (code.length !== 6) fields.code = a.codeLength;
    if (password.length < 8) fields.newPassword = a.passwordMin;
    if (confirm !== password) fields.confirm = t.mismatch;
    if (Object.keys(fields).length) return setErrors({ fields });

    setLoading(true);
    setErrors({ fields: {} });
    try {
      await authApi.confirmReset({ phone: normalizePhone(phone), code, newPassword: password });
      toast.success(t.changed);
      router.replace("/entrar");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "reset") {
    return (
      <>
        <AuthTitle
          title={t.resetTitle}
          subtitle={<>{t.resetBefore}<strong className="num text-verde">{normalizePhone(phone)}</strong>{t.resetAfter}</>}
        />
        <form onSubmit={submitReset} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <PasswordField label={t.newPassword} autoComplete="new-password" hint={a.passwordHint} value={password} onChange={setPassword} error={errors.fields.newPassword} />
          <PasswordField label={t.repeat} autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.fields.confirm} />
          <FormError message={errors.form} />
          <Button type="submit" loading={loading} block size="lg">
            {loading ? t.saving : t.save}
          </Button>
          <div className="flex justify-end">
            <ResendCode
              onResend={async () => {
                await authApi.requestReset({ phone: normalizePhone(phone) }).catch(() => undefined);
                toast.success(t.resent);
              }}
            />
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <form onSubmit={submitPhone} className="grid gap-5" noValidate>
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? dict.common.sending : t.submit}
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        {t.remembered}{" "}
        <Link href="/entrar" className="font-bold text-mel-texto hover:underline">
          {t.backToLogin}
        </Link>
      </p>
    </>
  );
}
