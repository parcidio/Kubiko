"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Palco 3D do hero. Inclina ligeiramente com o rato, só em dispositivos com hover e rato fino,
 * e nunca com prefers-reduced-motion. Escreve o transform direto no elemento (sem re-render).
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const hero = el?.closest("section");
    if (!el || !hero) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `rotateX(${(-ny * 10).toFixed(2)}deg) rotateY(${(nx * 14).toFixed(2)}deg)`;
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div className="lp-stage" ref={stage}>
      {children}
    </div>
  );
}
