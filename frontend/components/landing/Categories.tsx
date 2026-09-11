"use client";

import { useState, useRef } from "react";
import {
  Camera, Video, Mic, Calendar, Wrench, Cpu, Sofa, Car, Plus,
} from "lucide-react";

const items = [
  { label: "Fotografia",  icon: Camera   },
  { label: "Vídeo",       icon: Video    },
  { label: "Áudio",       icon: Mic      },
  { label: "Eventos",     icon: Calendar },
  { label: "Ferramentas", icon: Wrench   },
  { label: "Eletrónica",  icon: Cpu      },
  { label: "Mobiliário",  icon: Sofa     },
  { label: "Veículos",    icon: Car      },
  { label: "Mais",        icon: Plus     },
];

function CategoryItem({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex shrink-0 snap-start flex-col items-center gap-2">
      <button className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border-bg bg-card text-card-foreground transition-colors hover:border-primary hover:text-primary sm:h-16 sm:w-16">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
      <span className="text-xs text-[#3A3A36]">{label}</span>
    </div>
  );
}

export default function BeeznoCategories() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    let closest = 0;
    let minDist = Infinity;
    children.forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - el.scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIndex(closest);
  };

  const scrollToItem = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement;
    el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  };

  return (
    <section className="bg-background px-6 py-10 sm:px-8">
      <h1 className="mb-8 text-3xl font-semibold sm:text-4xl">
        Explora por categorias
      </h1>

      {/* ── Desktop (lg+): todos os itens centrados, sem scroll ── */}
      <div className="hidden lg:flex lg:flex-wrap lg:justify-center lg:gap-8">
        {items.map(({ label, icon: Icon }) => (
          <CategoryItem key={label} label={label} icon={Icon} />
        ))}
      </div>

      {/* ── Mobile / Tablet: carrossel com blur nas bordas ── */}
      <div className="relative lg:hidden">
        {/* Blur esquerda */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-background to-transparent sm:w-14" />
        {/* Blur direita */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-background to-transparent sm:w-14" />

        {/* Track */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory sm:gap-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map(({ label, icon: Icon }) => (
            <CategoryItem key={label} label={label} icon={Icon} />
          ))}
        </div>

        {/* Dots */}
        <div className="mt-5 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToItem(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}