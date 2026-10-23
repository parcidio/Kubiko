"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const inputClass = cn(
  "h-12 w-full rounded-campo border border-borda-forte bg-branco px-4 text-[15px] text-verde outline-none transition",
  "placeholder:text-cinza focus:border-verde focus:ring-4 focus:ring-verde-medio/15",
  "aria-invalid:border-2 aria-invalid:border-erro disabled:bg-areia-2 disabled:text-cinza",
);

export type FormErrors = { form?: string; fields: Record<string, string> };

/** Converte um erro da API em mensagem geral + erros por campo. */
export function toFormErrors(err: unknown): FormErrors {
  if (err instanceof ApiError) {
    return err.fields ? { fields: err.fields } : { form: err.message, fields: {} };
  }
  return { form: "Algo correu mal. Tenta outra vez.", fields: {} };
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-cartao bg-erro-tint p-4 text-sm text-erro">
      <AlertCircle className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
      <p>{message}</p>
    </div>
  );
}

// ── Campo base ────────────────────────────────────────────────────────────
interface FieldShellProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ id, label, hint, error, children, className }: FieldShellProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-verde">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[13px] text-cinza">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="text-[13px] font-medium text-erro">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: React.ReactNode) {
  return error ? `${id}-err` : hint ? `${id}-hint` : undefined;
}

type Common = { label: React.ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: React.ReactNode; className?: string };

export function TextField({ label, value, onChange, error, hint, className, ...rest }: Common & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({ label, value, onChange, error, hint, className, rows = 4, ...rest }: Common & Omit<React.ComponentProps<"textarea">, "value" | "onChange">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(inputClass, "h-auto resize-none py-3 leading-6")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({
  label, value, onChange, error, hint, className, options, placeholder,
}: Common & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        className={cn(inputClass, "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%230E2A1F' stroke-width='1.8' stroke-linecap='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[right_14px_center] bg-no-repeat pr-11")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Campo com afixo (+244, Kz). */
function AffixInput({
  id, prefix, suffix, error, hint, ...rest
}: { id: string; prefix?: string; suffix?: string; error?: string; hint?: React.ReactNode } & React.ComponentProps<"input">) {
  return (
    <div
      className={cn(
        "flex h-12 overflow-hidden rounded-campo border border-borda-forte bg-branco transition focus-within:border-verde focus-within:ring-4 focus-within:ring-verde-medio/15",
        error && "border-2 border-erro",
      )}
    >
      {prefix && <span className="flex items-center bg-areia-2 px-4 font-bold text-verde">{prefix}</span>}
      <input
        id={id}
        className="num min-w-0 flex-1 bg-transparent px-4 text-[15px] text-verde outline-none placeholder:text-cinza"
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
      {suffix && <span className="flex items-center bg-areia-2 px-4 font-bold text-verde">{suffix}</span>}
    </div>
  );
}

/** Telefone angolano: prefixo +244 fixo, 9 dígitos. */
export function PhoneField({ label = "Telefone", value, onChange, error, hint, className }: Partial<Common> & Pick<Common, "value" | "onChange">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <AffixInput
        id={id}
        prefix="+244"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="923 456 789"
        maxLength={11}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
        error={error}
        hint={hint}
      />
    </Field>
  );
}

/** Valor inteiro em kwanzas. Mostra com separador de milhares enquanto escreves. */
export function MoneyField({ label, value, onChange, error, hint, className }: Omit<Common, "value" | "onChange"> & { value: number | ""; onChange: (v: number | "") => void }) {
  const id = useId();
  const shown = value === "" ? "" : value.toLocaleString("de-DE");
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <AffixInput
        id={id}
        suffix="Kz"
        inputMode="numeric"
        placeholder="0"
        value={shown}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(digits ? Number(digits) : "");
        }}
        error={error}
        hint={hint}
      />
    </Field>
  );
}

export function PasswordField({
  label = "Password", value, onChange, error, hint, autoComplete = "current-password",
}: Omit<Common, "label"> & { label?: string; autoComplete?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className={cn(inputClass, "pr-12")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, hint)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-cinza hover:text-verde"
          aria-label={visible ? "Esconder password" : "Mostrar password"}
        >
          {visible ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
        </button>
      </div>
    </Field>
  );
}

/**
 * Código OTP: um único <input> real (bom para autofill de SMS e leitores de ecrã),
 * desenhado por cima como 6 casas.
 */
export function OtpField({ value, onChange, error, length = 6 }: { value: string; onChange: (v: string) => void; error?: string; length?: number }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Field id={id} label={`Código de ${length} dígitos`} error={error}>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={length}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="absolute inset-0 h-full w-full opacity-0"
        />
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length }, (_, i) => {
            const active = focused && (i === value.length || (i === length - 1 && value.length === length));
            return (
              <span
                key={i}
                className={cn(
                  "num flex h-14 items-center justify-center rounded-campo border bg-branco font-titulo text-2xl font-extrabold text-verde transition",
                  active ? "border-2 border-verde ring-4 ring-verde-medio/15" : value[i] ? "border-verde" : "border-borda-forte",
                  error && "border-erro",
                )}
              >
                {value[i] ?? ""}
              </span>
            );
          })}
        </div>
      </div>
    </Field>
  );
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; error?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-6">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-borda-forte bg-branco text-areia transition peer-checked:border-verde peer-checked:bg-verde peer-focus-visible:ring-4 peer-focus-visible:ring-verde-medio/25"
      >
        {checked && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span>
        {children}
        {error && <span className="mt-1 block text-[13px] font-medium text-erro">{error}</span>}
      </span>
    </label>
  );
}

/** RadioGroup em forma de cartões. */
export function RadioCards<T extends string>({
  legend, name, value, onChange, options, columns = 1,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; text?: string; icon?: LucideIcon }[];
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium text-verde">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {options.map(({ value: v, title, text, icon: Icon }) => (
          <label
            key={v}
            className={cn(
              "relative flex cursor-pointer items-start gap-3 rounded-cartao border bg-branco p-4 transition",
              "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-verde-medio/20",
              value === v ? "border-2 border-verde bg-salvia-tint/50 p-[15px]" : "border-borda-forte hover:border-verde",
            )}
          >
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {Icon && (
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", value === v ? "bg-verde text-ambar" : "bg-areia-2 text-mel")}>
                <Icon className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
            )}
            <span className="grid flex-1 gap-0.5">
              <span className="font-bold text-verde">{title}</span>
              {text && <span className="text-[13px] leading-5 text-cinza">{text}</span>}
            </span>
            <span
              aria-hidden
              className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2", value === v ? "border-verde" : "border-borda-forte")}
            >
              {value === v && <span className="size-2.5 rounded-full bg-verde" />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Chips de escolha única (filtros, motivos, estado). */
export function ChipGroup<T extends string>({
  label, value, onChange, options, className, scroll,
}: {
  label: string;
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  className?: string;
  scroll?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex gap-2", scroll ? "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" : "flex-wrap", className)}>
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition active:scale-[.97]",
              on ? "border-verde bg-verde text-areia" : "border-borda-forte bg-branco text-verde hover:border-verde",
            )}
          >
            {Icon && <Icon className={cn("size-4", on ? "text-ambar" : "text-mel")} strokeWidth={1.8} aria-hidden />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** Progresso de um fluxo em passos: "Passo 2 de 5 · Detalhes". */
export function StepProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-bold text-verde">{label}</span>
        <span className="num text-cinza">
          Passo {step} de {total}
        </span>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={label}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < step ? "bg-verde-medio" : "bg-skeleton")} />
        ))}
      </div>
    </div>
  );
}
