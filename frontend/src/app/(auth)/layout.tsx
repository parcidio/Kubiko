"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BadgeCheck, ShieldCheck, Ticket } from "lucide-react";
import { HexGlow, Logo } from "@/components/bz/brand";
import { HEX_CLIP, HexTile } from "@/components/bz/hex";

const PROMISES = [
  { icon: BadgeCheck, text: "Donos e arrendatários verificados" },
  { icon: ShieldCheck, text: "Caução devolvida quando tudo corre bem" },
  { icon: Ticket, text: "Pagas ao dono na entrega, com comprovativo" },
];

const EASE = "cubic-bezier(0.77, 0, 0.18, 1)";

/**
 * Hexágono 3D da marca (v4 §7): camadas recuadas com translateZ e brilho decrescente dão espessura.
 * Estático de propósito (na app nada roda sem fim); decorativo.
 */
function HexStack({ size, tone, className }: { size: number; tone: "ambar" | "salvia"; className?: string }) {
  const bg = tone === "ambar" ? "bg-ambar" : "bg-salvia";
  return (
    <div aria-hidden className={`pointer-events-none absolute [perspective:900px] ${className ?? ""}`}>
      <div className="relative [transform-style:preserve-3d] [transform:rotateX(18deg)_rotateY(-30deg)]" style={{ width: size, height: Math.round(size * 1.1547) }}>
        {[0, 1, 2, 3].map((n) => (
          <span
            key={n}
            className={`absolute inset-0 ${bg}`}
            style={{ clipPath: HEX_CLIP, transform: `translateZ(${-n * 3}px)`, filter: n ? `brightness(${[1, 0.8, 0.68, 0.9][n]})` : undefined }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname.startsWith("/registar");

  const contentRef = useRef<HTMLDivElement>(null);
  const prevIsRegister = useRef(isRegister);

  // A página nova entra pelo lado de onde o painel verde está a sair
  useEffect(() => {
    if (prevIsRegister.current === isRegister) return;
    prevIsRegister.current = isRegister;

    const el = contentRef.current;
    if (!el) return;
    const desktopMotion = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    if (!desktopMotion.matches) return;

    el.animate(
      [
        { transform: `translateX(${isRegister ? 70 : -70}%)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 700, easing: EASE, fill: "backwards" },
    );
  }, [isRegister]);

  return (
    <div className="app min-h-dvh">
      {/* Herói: faixa no telemóvel; no desktop fica fixo e troca de lado */}
      <aside
        className={`superficie-marca relative overflow-hidden bg-verde-noite px-4 pt-5 pb-14 text-areia md:fixed md:inset-y-0 md:left-0 md:z-10 md:flex md:w-[45.4545%] md:flex-col md:justify-between md:px-12 md:py-10 md:transition-transform md:duration-700 md:ease-[cubic-bezier(0.77,0,0.18,1)] md:will-change-transform ${
          isRegister ? "md:translate-x-[120%]" : "md:translate-x-0"
        }`}
      >
        <HexGlow />
        <HexStack size={74} tone="ambar" className="top-4 right-5 origin-top-right scale-[.7] md:top-6 md:right-8 md:scale-90" />
        <HexStack size={34} tone="salvia" className="top-52 right-44 hidden md:block" />
        <div className="relative">
          <Logo dark href="/" />
        </div>
        <div className="relative mt-8 grid gap-4 md:mt-0">
          <p className="max-w-[16ch] font-titulo text-[34px] leading-[1.02] font-extrabold tracking-[-0.025em] text-white md:text-[56px]">
            Por que comprar quando podes <span className="text-salvia">alugar?</span>
          </p>
          <ul className="hidden gap-3 md:grid">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="group flex items-center gap-3 text-salvia-tint">
                <HexTile icon={Icon} tone="salvia" size={40} flip />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-[13px] text-salvia-tint/80 md:block">Equipamento de fotografia, vídeo e eventos em Luanda.</p>
      </aside>

      {/* Só esta área faz scroll; a margem reserva o espaço do painel fixo */}
      <main
        className={`relative -mt-8 rounded-t-sheet bg-areia px-4 pt-8 pb-12 md:mt-0 md:flex md:min-h-dvh md:items-center md:rounded-none md:px-12 ${
          isRegister ? "md:mr-[45.4545%]" : "md:ml-[45.4545%]"
        }`}
      >
        <div ref={contentRef} className="mx-auto w-full max-w-md animate-sobe">
          {children}
        </div>
      </main>
    </div>
  );
}