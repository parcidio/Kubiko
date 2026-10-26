"use client";

import { useEffect, useState } from "react";
import { Camera, PackageOpen, Repeat } from "lucide-react";
import { OtpField, RadioCards } from "./form";
import { Button, buttonClass } from "./ui";
import { authApi } from "@/lib/api";
import { signIn } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-2">
      <h1 className="font-titulo text-[30px] leading-[1.05] font-extrabold tracking-tight text-verde md:text-[38px]">{title}</h1>
      {subtitle && <p className="text-[15px] text-cinza">{subtitle}</p>}
    </div>
  );
}

/** 2.º passo do login de uma conta ADMIN: código enviado por SMS (2FA). */
export function AdminMfaStep({ mfaToken, phoneHint, onDone }: { mfaToken: string; phoneHint?: string | null; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("O código tem 6 dígitos.");
    setLoading(true);
    setError(undefined);
    try {
      signIn(await authApi.loginMfa({ mfaToken, code }));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AuthTitle
        title="Confirma que és tu"
        subtitle={`Enviámos um código por SMS${phoneHint ? ` para ${phoneHint}` : ""}. As contas da equipa têm verificação em dois passos.`}
      />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <OtpField value={code} onChange={setCode} error={error} />
        <Button type="submit" loading={loading} block size="lg">
          {loading ? "A confirmar…" : "Confirmar e entrar"}
        </Button>
      </form>
    </>
  );
}

/** "Reenviar código" com espera de 60 s. */
export function ResendCode({ onResend }: { onResend: () => Promise<void> }) {
  const [seconds, setSeconds] = useState(60);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return (
    <button
      type="button"
      disabled={seconds > 0 || sending}
      className="num min-h-11 text-sm font-medium text-mel-texto hover:underline disabled:text-cinza disabled:no-underline"
      onClick={async () => {
        setSending(true);
        try {
          await onResend();
          setSeconds(60);
        } finally {
          setSending(false);
        }
      }}
    >
      {seconds > 0 ? `Reenviar código em 0:${String(seconds).padStart(2, "0")}` : "Reenviar código"}
    </button>
  );
}

export function GoogleButton({ label = "Continuar com Google" }: { label?: string }) {
  // NEXT_PUBLIC_API_URL = origem da API (staging: https://beeznoo.onrender.com). Vazio = mesma origem, pelo proxy do Next.
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  return (
    <a href={`${base}/oauth2/authorization/google`} className={buttonClass("outline", "md", true)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
      {label}
    </a>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-cinza" aria-hidden>
      <span className="h-px flex-1 bg-borda" /> ou <span className="h-px flex-1 bg-borda" />
    </div>
  );
}

export type SignupRole = Exclude<UserRole, "ADMIN">;

export function RolePicker({ value, onChange }: { value: SignupRole; onChange: (v: SignupRole) => void }) {
  return (
    <RadioCards<SignupRole>
      legend="Como vais usar a Beeznoo?"
      name="role"
      value={value}
      onChange={onChange}
      options={[
        { value: "RENTER", title: "Quero alugar", text: "Procuro equipamento para um trabalho ou evento.", icon: Camera },
        { value: "OWNER", title: "Tenho equipamento", text: "Quero ganhar dinheiro com o que está parado.", icon: PackageOpen },
        { value: "BOTH", title: "As duas coisas", text: "Alugo e ponho equipamento a render.", icon: Repeat },
      ]}
    />
  );
}
