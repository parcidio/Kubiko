"use client";

import type { ReactNode } from "react";

export type Objetivo = "alugar" | "disponibilizar" | "ambos";

/** Evento com que os botões "Quero alugar" / "Quero disponibilizar" escolhem a opção no formulário (#lista). */
export const WAITLIST_ROLE_EVENT = "beeznoo:waitlist-role";

/** Link para a lista de espera que já deixa escolhido o que a pessoa quer fazer. */
export default function WaitlistLink({
  objetivo,
  className,
  children,
}: {
  objetivo: Objetivo;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href="#lista"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent<Objetivo>(WAITLIST_ROLE_EVENT, { detail: objetivo }))}
    >
      {children}
    </a>
  );
}
