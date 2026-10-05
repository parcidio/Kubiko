"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const NUMERO = "244932300335";

function abrirWhatsapp() {
  const texto = encodeURIComponent("Olá! Tenho interesse em saber mais sobre o Beeznoo.");
  window.open(`https://wa.me/${NUMERO}?text=${texto}`, "_blank");
}

function HexBg() {
  const s = 52;
  const h = s * 0.866;
  const rows = [
    { y: 0,     xs: [52, 156, 260, 364, 468, 572, 676, 780, 884] },
    { y: h,     xs: [0, 104, 208, 312, 416, 520, 624, 728, 832, 936] },
    { y: h * 2, xs: [52, 156, 260, 364, 468, 572, 676, 780, 884] },
  ];
  const hexPath = (cx: number, cy: number) =>
    [
      [cx - s, cy], [cx - s / 2, cy - h], [cx + s / 2, cy - h],
      [cx + s, cy], [cx + s / 2, cy + h], [cx - s / 2, cy + h],
    ].map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 960 250"
      fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {rows.flatMap(({ y, xs }) =>
        xs.map((x, i) => (
          <polygon key={`${y}-${i}`} points={hexPath(x, y)}
            stroke="#FFC72C" strokeWidth="1" fill="none" opacity="0.08" />
        ))
      )}
    </svg>
  );
}

export default function BeeznoFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.7, ease }}
    >

      {/* ── CTA section ── */}
      <div className="relative overflow-hidden bg-primary px-6 py-20 text-center sm:px-8">
        <HexBg />

        {/* Hex icon */}
        <div className="relative z-10 mb-6 flex justify-center">
          <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
            <path
              d="M20 3 L35 11.5 V28.5 L20 37 L5 28.5 V11.5 Z"
              stroke="#FFC72C" strokeWidth="1.5" fill="none"
            />
            <path
              d="M20 11 L28 15.5 V24.5 L20 29 L12 24.5 V15.5 Z"
              stroke="#FFC72C" strokeWidth="1" fill="none" opacity="0.5"
            />
          </svg>
        </div>

        {/* Headline */}
        <h2 className="relative z-10 mx-auto max-w-2xl text-[2rem] font-bold leading-tight text-primary-foreground sm:text-4xl lg:text-5xl">
          Sê dos primeiros a entrar para o{" "}
          <span className="text-warning">Beeznoo.</span>
        </h2>

        {/* Descrição */}
        <p className="relative z-10 mx-auto mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/70 sm:text-base">
          A lista de espera está aberta. Inscreve-te e avisamos-te no dia do lançamento.
        </p>

        {/* CTAs */}
        <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={abrirWhatsapp}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-foreground/60 hover:bg-primary-foreground/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M20.52 3.449A11.82 11.82 0 0 0 12.04 0C5.495 0 .16 5.335.157 11.882c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.674 1.447h.005c6.542 0 11.88-5.335 11.883-11.882a11.82 11.82 0 0 0-3.403-8.462zM12.04 21.785h-.004a9.86 9.86 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.87 9.87 0 0 1-1.509-5.27c.002-5.45 4.437-9.884 9.89-9.884a9.83 9.83 0 0 1 7.008 2.906 9.83 9.83 0 0 1 2.903 7.01c-.003 5.45-4.438 9.87-9.919 9.87z" />
            </svg>
            Falar no WhatsApp
          </button>

          <a
            href="https://tally.so/r/dW7yGK"
            target="_blank"
            className="flex cursor-pointer items-center gap-2 rounded-full bg-warning px-6 py-3 text-sm font-bold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-warning/90 hover:shadow-lg"
          >
            Entrar na lista de espera
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* ── Barra inferior ── */}
      <div className="bg-primary/90">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-5 sm:flex-row sm:px-8">

          {/* Esquerda: logo + tagline */}
          <div className="flex items-center gap-3">
            <Image src="/png/beeznoo-icon-512.png" alt="logo" width={24} height={24} />
            <span className="font-bold text-primary-foreground/90">beeznoo</span>
            <span className="hidden text-xs text-primary-foreground/40 sm:block">
              · Marketplace de aluguer de equipamentos · Angola
            </span>
          </div>

          {/* Direita: links + copyright */}
          <div className="flex items-center gap-5 text-xs text-primary-foreground/50">
            <a href="https://instagram.com" target="_blank" className="transition-colors hover:text-primary-foreground">
              Instagram
            </a>
            <a href="mailto:hello@beeznoo.ao" className="transition-colors hover:text-primary-foreground">
              hello@beeznoo.ao
            </a>
            <span>© 2026 Beeznoo</span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}