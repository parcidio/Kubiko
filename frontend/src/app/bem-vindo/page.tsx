"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import { HexGlow, HexIllustration, Logo } from "@/components/bz/brand";
import { Button } from "@/components/bz/ui";
import { safeNext } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SLIDES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Handshake,
    title: "Alugas de quem tem, perto de ti",
    text: "Pedes as datas, o dono aceita em 24 h e só depois pagas. Sem compras de milhões para um trabalho de três dias.",
  },
  {
    icon: ShieldCheck,
    title: "A caução protege as duas partes",
    text: "Fica retida durante o aluguer e é devolvida quando o equipamento volta em ordem. Fotos na entrega e na devolução.",
  },
  {
    icon: BadgeCheck,
    title: "Toda a gente é verificada",
    text: "Antes da primeira reserva confirmamos a identidade com o BI (ou NIF, se fores empresa). Leva 2 minutos.",
  },
];

function Onboarding() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="app relative flex min-h-dvh flex-col overflow-hidden bg-verde-noite text-areia">
      <HexGlow />
      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
        <Logo dark href="/explorar" />
        <button type="button" onClick={() => router.replace(next)} className="min-h-11 px-2 text-sm font-medium text-areia/80 hover:text-areia">
          Saltar
        </button>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
        <div key={i} className="grid animate-sobe gap-6">
          <HexIllustration icon={slide.icon} tone="escuro" size={168} />
          <h1 className="font-titulo text-[34px] leading-[1.05] font-extrabold tracking-tight">{slide.title}</h1>
          <p className="text-lg text-areia/80">{slide.text}</p>
        </div>
      </main>
      <footer className="relative mx-auto grid w-full max-w-md gap-5 px-4 pb-8">
        <div className="flex justify-center gap-2" aria-label={`Passo ${i + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, n) => (
            <span key={n} className={cn("h-2 rounded-full transition-all", n === i ? "w-8 bg-ambar" : "w-2 bg-white/25")} />
          ))}
        </div>
        <Button size="lg" block onClick={() => (last ? router.replace(next) : setI(i + 1))}>
          {last ? "Começar" : "Seguinte"}
        </Button>
      </footer>
    </div>
  );
}

export default function BemVindoPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
