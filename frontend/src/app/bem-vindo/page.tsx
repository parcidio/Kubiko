"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import { HexGlow, Logo } from "@/components/bz/brand";
import { HexTile } from "@/components/bz/hex";
import { SuccessCheck } from "@/components/bz/success";
import { Button } from "@/components/bz/ui";
import { safeNext } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SLIDES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Handshake,
    title: "Alugas de quem tem, perto de ti",
    text: "Pedes as datas, o dono aceita em 24 h e só pagas na entrega, ao dono. Sem compras de milhões para um trabalho de três dias.",
  },
  {
    icon: ShieldCheck,
    title: "A caução protege as duas partes",
    text: "Fica com o dono durante o aluguer e ele devolve-ta quando o equipamento volta em ordem. Fotos na entrega e na devolução.",
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
        <button type="button" onClick={() => router.replace(next)} className="min-h-11 cursor-pointer px-2 text-sm font-medium text-salvia-tint hover:text-white">
          Saltar
        </button>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
        <div key={i} className="grid animate-sobe justify-items-start gap-6">
          {/* 1.º ecrã logo a seguir a criar a conta: confirmação; os outros explicam com o hexágono da marca */}
          {i === 0 ? <SuccessCheck size={96} /> : <HexTile icon={slide.icon} tone="salvia" size={88} flip />}
          {i === 0 && <p className="-mb-3 text-xs font-bold tracking-[0.12em] text-salvia uppercase">Conta criada</p>}
          <h1 className="font-titulo text-[34px] leading-[1.05] font-extrabold tracking-[-0.025em] text-white">{slide.title}</h1>
          <p className="text-lg text-salvia-tint">{slide.text}</p>
        </div>
      </main>
      <footer className="relative mx-auto grid w-full max-w-md gap-5 px-4 pb-8">
        <div role="img" className="flex justify-center gap-0.5" aria-label={`Passo ${i + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, n) => (
            <span key={n} className={cn("h-2 w-6 rounded-full transition-[transform,background-color] duration-350 ease-out", n === i ? "bg-salvia" : "scale-x-[.34] bg-white/25")} />
          ))}
        </div>
        <Button size="lg" block arrow={!last} onClick={() => (last ? router.replace(next) : setI(i + 1))}>
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
