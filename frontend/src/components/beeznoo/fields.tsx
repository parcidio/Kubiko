"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[13px] text-erro">
      {message}
    </p>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}

export function TextField({
  label, value, onChange, error, hint, ...rest
}: FieldProps & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        {...rest}
      />
      {hint && !error && <p className="text-[13px] text-cinza">{hint}</p>}
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

/** Telefone angolano: prefixo +244 fixo, 9 dígitos. */
export function PhoneField({ label = "Telefone", value, onChange, error }: Partial<FieldProps> & Pick<FieldProps, "value" | "onChange">) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex">
        <span className="flex h-11 items-center rounded-l-bz-sm border border-r-0 border-borda-forte bg-areia-2 px-3 text-[15px] text-verde">
          +244
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="923 456 789"
          maxLength={11}
          className="rounded-l-none"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

export function PasswordField({
  label = "Password", value, onChange, error, hint, autoComplete = "current-password",
}: Omit<FieldProps, "label"> & { label?: string; autoComplete?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className="pr-12"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-cinza hover:text-verde"
          aria-label={visible ? "Esconder password" : "Mostrar password"}
        >
          {visible ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
        </button>
      </div>
      {hint && !error && <p className="text-[13px] text-cinza">{hint}</p>}
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

export function OtpField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="grid gap-2">
      <Label>Código de 6 dígitos</Label>
      <InputOTP maxLength={6} value={value} onChange={onChange} inputMode="numeric" autoComplete="one-time-code" aria-invalid={!!error}>
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <FieldError id="otp-err" message={error} />
    </div>
  );
}
