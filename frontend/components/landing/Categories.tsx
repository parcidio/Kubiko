"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Camera, Video, Mic, Calendar, Wrench, Cpu, Sofa, Car, Plus,
} from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const items = [
  { label: "Fotografia",  icon: Camera   },
  { label: "Vídeo",       icon: Video    },
  { label: "Áudio",       icon: Mic      },
  { label: "Eventos",     icon: Calendar },
  { label: "Ferramentas", icon: Wrench   },
  { label: "Eletrónica",  icon: Cpu      },
  { label: "Mobiliário",  icon: Sofa     },
  { label: "Veículos",    icon: Car      },
  { label: "Todas",       icon: Plus     },
];

function CategoryItem({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <motion.div
      className="flex shrink-0 snap-start flex-col items-center gap-2"
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onClick}
        className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-border-bg bg-card text-card-foreground shadow-card transition-opacity hover:opacity-90 sm:h-16 sm:w-16"
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
      <span className="text-xs text-muted-foreground">{label}</span>
    </motion.div>
  );
}

export default function BeeznoCategories() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router    = useRouter();

  const handleCategoryClick = (label: string) => {
    if (label === "Todas") {
      router.push("/items");
    } else {
      router.push(`/items?categoria=${encodeURIComponent(label)}`);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    let closest = 0;
    let minDist  = Infinity;
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
    <motion.section
      id="categories"
      className="bg-background px-6 py-10 sm:px-8"
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.7, ease }}
    >
      <div className="flex flex-col gap-4 px-6 mx-auto">
        <h1 className="uppercase tracking-widest text-xs font-sans font-bold text-shield">O que vais encontrar</h1>
        <h1 className="mb-8 font-display text-3xl font-extrabold sm:text-4xl">
          Do berbequim à betoneira.
        </h1>
      </div>

      {/* Desktop */}
      <motion.div
        className="hidden lg:flex lg:flex-wrap lg:justify-center lg:gap-8"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden" whileInView="visible" viewport={{ once: true }}
      >
        {items.map(({ label, icon }) => (
          <CategoryItem
            key={label} label={label} icon={icon}
            onClick={() => handleCategoryClick(label)}
          />
        ))}
      </motion.div>

      {/* Mobile / Tablet */}
      <div className="relative lg:hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-linear-to-r from-background to-transparent sm:w-14" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-linear-to-l from-background to-transparent sm:w-14" />

        <motion.div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory sm:gap-6"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map(({ label, icon }) => (
            <CategoryItem
              key={label} label={label} icon={icon}
              onClick={() => handleCategoryClick(label)}
            />
          ))}
        </motion.div>

        <div className="mt-6 flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToItem(i)}
              className={`h-2 rounded-full transition-opacity hover:opacity-90 ${
                i === activeIndex ? "w-6 bg-primary" : "w-2 bg-border-bg"
              }`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}