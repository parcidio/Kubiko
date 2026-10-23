"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-2">
      <h1 className="font-heading text-[26px] leading-tight text-verde md:text-[32px]">{title}</h1>
      {subtitle && <p className="text-[15px] text-cinza">{subtitle}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="erro" role="alert">
      <AlertDescription className="text-current">{message}</AlertDescription>
    </Alert>
  );
}

/** Converte um erro da API em mensagem geral + erros por campo. */
export function toFormErrors(err: unknown): { form?: string; fields: Record<string, string> } {
  if (err instanceof ApiError) {
    return err.fields ? { form: undefined, fields: err.fields } : { form: err.message, fields: {} };
  }
  return { form: "Algo correu mal. Tenta outra vez.", fields: {} };
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
    <Button
      type="button"
      variant="link"
      disabled={seconds > 0 || sending}
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
      {seconds > 0 ? `Reenviar código em ${seconds} s` : "Reenviar código"}
    </Button>
  );
}

export function GoogleButton({ label = "Continuar com Google" }: { label?: string }) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  return (
    <Button asChild variant="outline" className="w-full">
      <a href={`${base}/oauth2/authorization/google`}>
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
        {label}
      </a>
    </Button>
  );
}

export function Divider() {
  return (
    <div className="my-2 flex items-center gap-3 text-[13px] text-cinza" aria-hidden>
      <span className="h-px flex-1 bg-borda" /> ou <span className="h-px flex-1 bg-borda" />
    </div>
  );
}

const ROLES = [
  { value: "RENTER", title: "Quero alugar", text: "Procuro equipamento para um trabalho ou evento." },
  { value: "OWNER", title: "Tenho equipamento", text: "Quero ganhar dinheiro com o que tenho parado." },
  { value: "BOTH", title: "As duas coisas", text: "Alugo e também ponho equipamento a render." },
] as const;

export type SignupRole = (typeof ROLES)[number]["value"];

/** RadioCard para escolher o papel na plataforma. */
export function RolePicker({ value, onChange }: { value: SignupRole; onChange: (v: SignupRole) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium text-verde">Como vais usar o Beeznoo?</legend>
      {ROLES.map((r) => (
        <label
          key={r.value}
          className="flex cursor-pointer items-start gap-3 rounded-bz-md border border-borda bg-branco p-3 has-[:checked]:border-verde has-[:checked]:bg-salvia-tint has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-verde-medio/30"
        >
          <input
            type="radio"
            name="role"
            value={r.value}
            checked={value === r.value}
            onChange={() => onChange(r.value)}
            className="mt-1 size-4 accent-verde"
          />
          <span className="grid gap-0.5">
            <span className="text-[15px] font-medium text-verde">{r.title}</span>
            <span className="text-[13px] text-cinza">{r.text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
