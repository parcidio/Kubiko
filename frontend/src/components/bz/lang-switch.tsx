"use client";

import { useLang, useSetLang, useT } from "@/lib/i18n/client";
import { LANGS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Seletor de língua PT | EN (decisão 2026-11-17, ponto 7). Alvos de 44px, grava o cookie `lang`.
 * `dark` = sobre fundos verdes (landing, painel de autenticação, herói).
 */
export function LangSwitch({ dark, className }: { dark?: boolean; className?: string }) {
  const lang = useLang();
  const t = useT();
  const { setLang, pending } = useSetLang();
  return (
    <div
      role="group"
      aria-label={t.common.language}
      aria-busy={pending || undefined}
      className={cn("inline-flex shrink-0 items-center rounded-full p-0.5", dark ? "bg-white/10" : "bg-areia-2", className)}
    >
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            lang={l === "pt" ? "pt-PT" : "en"}
            aria-pressed={active}
            aria-label={l === "pt" ? "Português" : "English"}
            onClick={() => !active && setLang(l)}
            className={cn(
              "inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-[13px] font-bold tracking-[0.06em] uppercase transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar",
              active
                ? dark ? "bg-areia text-verde" : "bg-verde text-areia"
                : dark ? "text-salvia-tint hover:text-white" : "text-verde hover:bg-skeleton",
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
