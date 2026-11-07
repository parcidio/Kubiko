"use client";

import { useEffect, useRef } from "react";

export function Firefly() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    const host = glow?.parentElement;
    if (!glow || !host) return;
    // Sem efeito em ecrãs tácteis ou com "reduzir movimento"
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0, targetY = 0, x = 0, y = 0;
    let level = 0; // 0 = apagado, 1 = aceso
    let active = false;
    let raf = 0;

    const tick = (t: number) => {
      x += (targetX - x) * 0.08; // segue o cursor com atraso, como voo
      y += (targetY - y) * 0.08;
      level += ((active ? 1 : 0) - level) * 0.06;
      const flicker = 0.85 + Math.sin(t / 180) * 0.15; // pisca suave

      glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      glow.style.opacity = String(level * flicker);

      if (active || level > 0.01) raf = requestAnimationFrame(tick);
      else {
        glow.style.opacity = "0";
        raf = 0;
      }
    };

    const setTarget = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      targetX = e.clientX - r.left;
      targetY = e.clientY - r.top;
    };

    const onEnter = (e: PointerEvent) => {
      setTarget(e);
      if (level < 0.01) { x = targetX; y = targetY; } // aparece onde entras
      active = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => setTarget(e);
    const onLeave = () => { active = false; };

    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={glowRef}
        className="absolute top-0 left-0 size-44 rounded-full text-primary-foreground opacity-0 mix-blend-screen will-change-transform"
        style={{ background: "radial-gradient(circle, currentColor 0%, transparent 65%)" }}
      >
        {/* núcleo mais brilhante */}
        <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current blur-[2px]" />
      </div>
    </div>
  );
}