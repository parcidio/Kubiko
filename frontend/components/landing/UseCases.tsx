"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Speaker, Camera, Truck, ChevronLeft, ChevronRight } from "lucide-react";

const INTERVAL = 5000;

const slides = [
  {
    id: "01",
    title: "Obras em casa",
    description: "Remodelar a cozinha ou levantar um muro? Aluga a betoneira, os andaimes e as ferramentas só pelos dias da obra.",
    tags: ["Betoneira", "Andaimes", "Martelo demolidor"],
    icon: Building2,
    cardBg:       "bg-warning",
    textColor:    "text-primary",
    counterColor: "text-primary",
    descColor:    "text-primary/70",
    hexColor:     "#0E3B2C",
    iconColor:    "#FFC72C",
    tagClass:     "bg-primary text-primary-foreground",
  },
  {
    id: "02",
    title: "Eventos e festas",
    description: "Casamento, aniversário ou conferência: som, iluminação, tendas e cadeiras para o fim de semana.",
    tags: ["Colunas de som", "Tendas", "Iluminação"],
    icon: Speaker,
    cardBg:       "bg-primary",
    textColor:    "text-primary-foreground",
    counterColor: "text-warning",
    descColor:    "text-primary-foreground/70",
    hexColor:     "#FFC72C",
    iconColor:    "#0E3B2C",
    tagClass:     "bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20",
  },
  {
    id: "03",
    title: "Foto, vídeo e criação",
    description: "Câmaras, lentes, drones e luzes para aquele projeto que não justifica comprar equipamento novo.",
    tags: ["Câmaras", "Drones", "Kits de luz"],
    icon: Camera,
    cardBg:       "bg-shield-soft",
    textColor:    "text-primary",
    counterColor: "text-shield",
    descColor:    "text-primary/70",
    hexColor:     "#0E3B2C",
    iconColor:    "#C9DDD1",
    tagClass:     "bg-card text-foreground border border-border",
  },
  {
    id: "04",
    title: "Empresas com máquinas paradas",
    description: "Equipamento sem uso entre projetos? Aluga-o a outras empresas e particulares, com contrato e caução em cada reserva.",
    tags: ["Geradores", "Empilhadores", "Compressores"],
    icon: Truck,
    cardBg:       "bg-card",
    textColor:    "text-primary",
    counterColor: "text-primary",
    descColor:    "text-muted-foreground",
    hexColor:     "#FFC72C",
    iconColor:    "#0E3B2C",
    tagClass:     "bg-warning-soft text-primary",
  },
];

// ── Fundo hexagonal ────────────────────────────────────
function HexBg({ color }: { color: string }) {
  const width = 46;
  const height = width * 1.13;

  const horizontalGap = width * 2;
  const verticalGap = height * 1.5;

  const rows = Array.from({ length: 6 }, (_, row) => ({
    y: row * verticalGap,
    offset: row % 2 === 0 ? width : 0,
  }));

  const hexPath = (cx: number, cy: number) =>
    [
      [cx, cy - height],
      [cx + width, cy - height * 0.5],
      [cx + width, cy + height * 0.5],
      [cx, cy + height],
      [cx - width, cy + height * 0.5],
      [cx - width, cy - height * 0.5],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(" ");

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 280"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {rows.flatMap(({ y, offset }) =>
        Array.from({ length: 6 }, (_, i) => {
          const x = i * horizontalGap + offset;

          return (
            <polygon
              key={`${x}-${y}`}
              points={hexPath(x, y)}
              stroke={color}
              strokeWidth="1.1"
              fill="none"
              opacity="0.16"
            />
          );
        })
      )}
    </svg>
  );
}
// ── Ícone hexagonal ────────────────────────────────────
function HexIcon({
  icon: Icon,
  hexColor,
  iconColor,
}: {
  icon: React.ElementType;
  hexColor: string;
  iconColor: string;
}) {
  return (
    <div
      className="relative z-10 flex items-center justify-center"
      style={{
        width: 164,
        height: 164,
        backgroundColor: hexColor,
        clipPath:
          "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
      }}
    >
      <Icon size={66} color={iconColor} strokeWidth={1.5} />
    </div>
  );
}

// ── Componente principal ───────────────────────────────
export default function BeeznoUseCases() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }    
      timerRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % slides.length);
    }, INTERVAL);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
        if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      };
    }
  }, [startTimer]);

  const go = (dir: 1 | -1) => {
    setActive(prev => (prev + dir + slides.length) % slides.length);
    startTimer();
  };

  const slide = slides[active];

  const PrevBtn = ({ sm }: { sm?: boolean }) => (
    <button
      onClick={() => go(-1)}
      className={`flex items-center justify-center rounded-full border border-border bg-card text-foreground transition-all hover:-translate-y-0.5 hover:border-primary ${sm ? "h-9 w-9" : "h-10 w-10"}`}
    >
      <ChevronLeft className={sm ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );

  const NextBtn = ({ sm }: { sm?: boolean }) => (
    <button
      onClick={() => go(1)}
      className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/85 ${sm ? "h-9 w-9" : "h-10 w-10"}`}
    >
      <ChevronRight className={sm ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );

  const Dots = () => (
    <div className="flex items-center gap-2">
      {slides.map((_, i) => (
        <button
          key={i}
          onClick={() => { setActive(i); startTimer(); }}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === active ? "w-8 bg-primary" : "w-2 bg-border"
          }`}
        />
      ))}
    </div>
  );

  return (
    <section className="bg-background px-6 py-16 sm:px-8 sm:py-20" id="categories">
      <div className="mx-auto max-w-6xl">

        {/* Cabeçalho */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-shield">
              Para cada ocasião
            </p>
            <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
              O equipamento certo, quando precisas.
            </h2>
          </div>
          {/* Setas desktop */}
          <div className="hidden shrink-0 gap-2 lg:flex">
            <PrevBtn />
            <NextBtn />
          </div>
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className={`overflow-hidden rounded-2xl ${slide.cardBg}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* ── Desktop: lado a lado ── */}
            <div className="hidden min-h-75 grid-cols-2 lg:grid">
              {/* Texto */}
              <div className="flex flex-col justify-center p-10">
                <p className={`text-sm font-bold ${slide.counterColor}`}>
                  {slide.id} / 04
                </p>
                <h3 className={`mt-3 text-[2rem] font-bold leading-tight ${slide.textColor}`}>
                  {slide.title}
                </h3>
                <p className={`mt-4 max-w-xs text-sm leading-relaxed ${slide.descColor}`}>
                  {slide.description}
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {slide.tags.map(tag => (
                    <span
                      key={tag}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold ${slide.tagClass}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {/* Ícone */}
              <div className="relative flex items-center justify-center overflow-hidden">
                <HexBg color={slide.hexColor} />
                <HexIcon icon={slide.icon} hexColor={slide.hexColor} iconColor={slide.iconColor} />
              </div>
            </div>

            {/* ── Mobile: empilhado ── */}
            <div className="lg:hidden">
              <div className="relative flex h-52 items-center justify-center overflow-hidden">
                <HexBg color={slide.hexColor} />
                <HexIcon icon={slide.icon} hexColor={slide.hexColor} iconColor={slide.iconColor} />
              </div>
              <div className="p-6">
                <p className={`text-sm font-bold ${slide.counterColor}`}>{slide.id} / 04</p>
                <h3 className={`mt-2 text-2xl font-bold leading-tight ${slide.textColor}`}>
                  {slide.title}
                </h3>
                <p className={`mt-3 text-sm leading-relaxed ${slide.descColor}`}>
                  {slide.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {slide.tags.map(tag => (
                    <span
                      key={tag}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${slide.tagClass}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Nav inferior */}
        <div className="mt-5 flex items-center justify-between">
          <Dots />
          {/* Setas mobile */}
          <div className="flex gap-2 lg:hidden">
            <PrevBtn sm />
            <NextBtn sm />
          </div>
        </div>
      </div>
    </section>
  );
}