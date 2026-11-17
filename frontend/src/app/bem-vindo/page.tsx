"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import { HexGlow, Logo } from "@/components/bz/brand";
import { HexTile } from "@/components/bz/hex";
import { SuccessCheck } from "@/components/bz/success";
import { Button } from "@/components/bz/ui";
import { safeNext } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const SLIDE_ICONS: LucideIcon[] = [Handshake, ShieldCheck, BadgeCheck];

function Onboarding() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [i, setI] = useState(0);
  const dict = useT();
  const t = dict.onboarding;
  const SLIDES = t.slides.map((s, n) => ({ ...s, icon: SLIDE_ICONS[n] }));
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="app superficie-marca relative flex min-h-dvh flex-col overflow-hidden bg-verde-noite text-areia">
      <HexGlow />
      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
        <Logo dark href="/explorar" />
        <button type="button" onClick={() => router.replace(next)} className="min-h-11 cursor-pointer px-2 text-sm font-medium text-salvia-tint hover:text-white">
          {t.skip}
        </button>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
        <div key={i} className="grid animate-sobe justify-items-start gap-6">
          {/* 1.º ecrã logo a seguir a criar a conta: confirmação; os outros explicam com o hexágono da marca */}
          {i === 0 ? <SuccessCheck size={96} /> : <HexTile icon={slide.icon} tone="salvia" size={88} flip />}
          {i === 0 && <p className="-mb-3 text-xs font-bold tracking-[0.12em] text-salvia uppercase">{t.created}</p>}
          <h1 className="font-titulo text-[34px] leading-[1.05] font-extrabold tracking-[-0.025em] text-white">{slide.title}</h1>
          <p className="text-lg text-salvia-tint">{slide.text}</p>
        </div>
      </main>
      <footer className="relative mx-auto grid w-full max-w-md gap-5 px-4 pb-8">
        <div role="img" className="flex justify-center gap-0.5" aria-label={fmt(dict.form.step, { step: i + 1, total: SLIDES.length })}>
          {SLIDES.map((_, n) => (
            <span key={n} className={cn("h-2 w-6 rounded-full transition-[transform,background-color] duration-350 ease-out", n === i ? "bg-salvia" : "scale-x-[.34] bg-white/25")} />
          ))}
        </div>
        <Button size="lg" block arrow={!last} onClick={() => (last ? router.replace(next) : setI(i + 1))}>
          {last ? t.start : t.next}
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
