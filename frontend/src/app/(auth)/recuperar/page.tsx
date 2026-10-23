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

export default function RecuperarPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [loading, setLoading] = useState(false);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErrors({ fields: { phone: "Escreve os 9 dígitos do teu número." } });
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
    if (code.length !== 6) fields.code = "O código tem 6 dígitos.";
    if (password.length < 8) fields.newPassword = "A password tem de ter pelo menos 8 caracteres.";
    if (confirm !== password) fields.confirm = "As passwords não coincidem.";
    if (Object.keys(fields).length) return setErrors({ fields });

    setLoading(true);
    setErrors({ fields: {} });
    try {
      await authApi.confirmReset({ phone: normalizePhone(phone), code, newPassword: password });
      toast.success("Password alterada. Já podes entrar.");
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
          title="Nova password"
          subtitle={<>Se <strong className="num text-verde">{normalizePhone(phone)}</strong> tiver conta, recebes um código.</>}
        />
        <form onSubmit={submitReset} className="grid gap-5" noValidate>
          <OtpField value={code} onChange={setCode} error={errors.fields.code} />
          <PasswordField label="Nova password" autoComplete="new-password" hint="Pelo menos 8 caracteres." value={password} onChange={setPassword} error={errors.fields.newPassword} />
          <PasswordField label="Repete a nova password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.fields.confirm} />
          <FormError message={errors.form} />
          <Button type="submit" loading={loading} block size="lg">
            {loading ? "A guardar…" : "Guardar nova password"}
          </Button>
          <div className="flex justify-end">
            <ResendCode
              onResend={async () => {
                await authApi.requestReset({ phone: normalizePhone(phone) }).catch(() => undefined);
                toast.success("Se o número tiver conta, enviámos um novo código.");
              }}
            />
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthTitle title="Recuperar acesso" subtitle="Escreve o número da tua conta. Enviamos-te um código." />
      <form onSubmit={submitPhone} className="grid gap-5" noValidate>
        <PhoneField value={phone} onChange={setPhone} error={errors.fields.phone} />
        <FormError message={errors.form} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? "A enviar…" : "Enviar código"}
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-cinza">
        Lembraste-te?{" "}
        <Link href="/entrar" className="font-bold text-mel-texto hover:underline">
          Voltar a entrar
        </Link>
      </p>
    </>
  );
}
