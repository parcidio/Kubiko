"use client";

import { ErrorState } from "@/components/bz/states";
import { ButtonLink } from "@/components/bz/ui";
import { useT } from "@/lib/i18n/client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT().states;
  return (
    <div className="app grid min-h-dvh place-items-center px-4">
      <div className="grid justify-items-center gap-2">
        <ErrorState message={t.genericError} onRetry={reset} />
        <ButtonLink href="/explorar" variant="ghost">{t.backHome}</ButtonLink>
      </div>
    </div>
  );
}
