"use client";

import { ErrorState } from "@/components/bz/states";
import { ButtonLink } from "@/components/bz/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="app grid min-h-dvh place-items-center px-4">
      <div className="grid justify-items-center gap-2">
        <ErrorState message="Algo correu mal do nosso lado. Já estamos a ver." onRetry={reset} />
        <ButtonLink href="/explorar" variant="ghost">Voltar ao início</ButtonLink>
      </div>
    </div>
  );
}
