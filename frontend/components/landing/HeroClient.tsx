"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ── Data de abertura (hora de Luanda). Depois desta data a contagem desaparece. ──
const LAUNCH_DATE = new Date("2026-11-17T13:00:00+01:00");

type Left = { d: string; h: string; m: string; s: string } | null;

function timeLeft(): Left | "done" {
  const diff = Math.floor((LAUNCH_DATE.getTime() - Date.now()) / 1000);
  if (diff <= 0) return "done";
  const p = (n: number) => String(n).padStart(2, "0");
  return { d: p(Math.floor(diff / 86400)), h: p(Math.floor((diff % 86400) / 3600)), m: p(Math.floor((diff % 3600) / 60)), s: p(diff % 60) };
}

/** Contagem até à abertura. No servidor mostra "--" (sem desencontro de hidratação). */
export function Countdown({ label, units: names }: { label: string; units: { d: string; h: string; m: string; s: string } }) {
  const [left, setLeft] = useState<Left | "done">(null);

  useEffect(() => {
    const tick = () => setLeft(timeLeft());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (left === "done") return null;
  const units = (["d", "h", "m", "s"] as const).map((k) => ({ k, label: names[k] }));

  return (
    <div>
      <div className="lp-eyebrow lp-eyebrow--dark" style={{ marginBottom: 10 }} id="lp-cd-label">
        {label}
      </div>
      {/* role="timer" sem aria-live: não interrompe o leitor de ecrã a cada segundo */}
      <div className="lp-cd" role="timer" aria-labelledby="lp-cd-label">
        {units.map((u) => (
          <div className="lp-cd__t" key={u.k}>
            <span className="lp-sg lp-cd__n">{left ? left[u.k] : "--"}</span>
            <span className="lp-cd__l">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
