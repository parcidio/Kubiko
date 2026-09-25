"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Package, Shield, Star, Leaf } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop";

const stats = [
  { icon: Package, value: 200, prefix: "+", label: "Equipamentos disponíveis" },
  { icon: Shield, value: 100, suffix: "%", label: "Transações seguras" },
  { icon: Star, value: 4.8, decimals: 1, label: "Avaliação média (baseada em 300+ reviews)" },
];

type ContactModalProps = {
  setContactModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  abrirWhatsapp: (tipo: TipoContacto) => void;
};

type TipoContacto = "arrendador" | "arrendatario";

function abrirWhatsapp(tipo: TipoContacto, imovelId?: string): void {
  const mensagens: Record<TipoContacto, string> = {
    arrendador: "Olá! Sou um arrendador. Quero anunciar o meu item na Beeznoo.",
    arrendatario: "Olá! Sou um arrendatário. Vi um item na Beeznoo e tenho interesse em avançar.",
  };

  const NUMERO_KUBIKO = "244939351150";
  const texto = encodeURIComponent(mensagens[tipo]);
  const link = `https://wa.me/${NUMERO_KUBIKO}?text=${texto}`;

  const query = imovelId ? `&imovel_id=${imovelId}` : "";
  fetch(`/api/track-click?tipo=${tipo}${query}`).catch(() => {});

  window.open(link, "_blank");
}

function StatCounter({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const displayValue = useTransform(count, (latest) => `${prefix}${latest.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, { duration: 1.2, ease });
      return controls.stop;
    }
  }, [count, isInView, value]);

  return <motion.span ref={ref}>{displayValue}</motion.span>;
}

function ContactModal({
  setContactModalOpen,
  abrirWhatsapp,
}: ContactModalProps)
{
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setContactModalOpen(false)}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-white/20 bg-background/90 p-6 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.2, ease }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Como vais utilizar a Beeznoo?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolhe uma opção para continuarmos pelo WhatsApp.
          </p>
        </div>

        <div className="grid gap-3">
          <button onClick={() => {abrirWhatsapp("arrendador"); setContactModalOpen(false)}} className="group flex items-center cursor-pointer justify-between rounded-xl border border-border-bg bg-secondary px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-card">
            <div>
              <div className="font-semibold text-secondary-foreground">
                Arrendador
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Quero publicar o meu equipamento
              </div>
            </div>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>

          <button onClick={() => {abrirWhatsapp("arrendatario"); setContactModalOpen(false)}} className="group flex items-center cursor-pointer justify-between rounded-xl bg-primary px-4 py-4 text-left text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
            <div>
              <div className="font-semibold">
                Arrendatário
              </div>
              <div className="mt-0.5 text-xs text-primary-foreground/70">
                Quero encontrar um equipamento
              </div>
            </div>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        <button onClick={() => setContactModalOpen(false)} className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function BeeznoHero() {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  return (
    <motion.section id="explore" className="relative flex min-h-screen items-center overflow-hidden bg-background" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>

      {/* Curva — ~10% menor */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-primary sm:h-48 lg:h-56"
        style={{ clipPath: "ellipse(65% 60% at 30% 100%)" }}
      />

      {/* Estatísticas */}
      <div className="absolute bottom-8 left-8 z-10 flex flex-wrap gap-6 lg:flex">
        {stats.map(({ icon: Icon, value, prefix, suffix, decimals, label }) => (
          <motion.div key={label} className="flex items-start gap-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease }}>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-primary-foreground"><StatCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} /></div>
              <div className="max-w-32 text-[11px] text-primary-foreground/60">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Grid — padding e gap reduzidos */}
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-2 lg:gap-6 lg:px-10 lg:py-12">

        {/* Coluna de texto */}
        <motion.div className="relative z-10 flex flex-col justify-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}>


          {/* Título — ~10% menor */}
          <h1 className="text-[2.3rem] font-semibold leading-[1.08] text-foreground sm:text-[2.8rem] lg:text-[2.9rem]">
            Para quem precisa
            <br />
            <span className="text-primary/90">usar</span>, não precisa
            <br />
            possuir.
          </h1>

          {/* Descrição */}
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-foreground/80 sm:text-[15px] lg:max-w-lg lg:text-base">
            Na Beeznoo, encontras e alugas equipamentos de qualidade para
            fotografia, vídeo, áudio, eventos e muito mais. Tudo de forma
            simples, segura e perto de ti.
          </p>

         {/* CTAs linha 1 */}
          <div className="mt-5 flex flex-wrap items-center gap-3">

          {/* CTA 1 — Procurar um item: primary → teal sliding */}
          <a
            href="https://tally.so/r/dW7yGK"
            target="_blank"
            className="group relative overflow-hidden cursor-pointer rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-shadow duration-300 hover:shadow-lift"
          >
            <span className="absolute inset-0 -translate-x-full bg-shield/90 transition-transform duration-300 ease-out group-hover:translate-x-0" />
            <span className="relative">Procurar um item</span>
          </a>

          {/* CTA 2 — Publicar: outline → fills with primary */}
          <a
            href="https://tally.so/r/5BN0JZ"
            target="_blank"
            className="group relative overflow-hidden cursor-pointer rounded-sm border border-border-bg bg-secondary px-5 py-2 text-sm font-semibold text-secondary-foreground transition-shadow duration-300 hover:shadow-card"
          >
            <span className="absolute inset-0 -translate-x-full bg-primary/70 transition-transform duration-300 ease-out group-hover:translate-x-0" />
            <span className="relative transition-colors duration-300 group-hover:text-primary-foreground">
              Publicar o meu item
            </span>
          </a>
          </div>

          {/* CTA 3 — WhatsApp: accent → shield sliding */}
          <div className="mt-4 flex">
          <button onClick={() => setContactModalOpen(true)} className="group relative flex items-center gap-2 overflow-hidden text-sm cursor-pointer rounded-sm bg-accent px-14 py-2 font-semibold text-accent-foreground transition-shadow duration-300 hover:shadow-card">
            <span className="absolute inset-0 -translate-x-full bg-shield transition-transform duration-300 ease-out group-hover:translate-x-0" />

            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:text-shield-foreground" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M20.52 3.449A11.82 11.82 0 0 0 12.04 0C5.495 0 .16 5.335.157 11.882c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.674 1.447h.005c6.542 0 11.88-5.335 11.883-11.882a11.82 11.82 0 0 0-3.403-8.462zM12.04 21.785h-.004a9.86 9.86 0 0 1-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.87 9.87 0 0 1-1.509-5.27c.002-5.45 4.437-9.884 9.89-9.884a9.83 9.83 0 0 1 7.008 2.906 9.83 9.83 0 0 1 2.903 7.01c-.003 5.45-4.438 9.87-9.919 9.87z" />
            </svg>
            <span className="relative transition-colors duration-300 group-hover:text-shield-foreground">
              Entrar em contacto pelo WhatsApp
            </span>
          </button>
          </div>

          {/* Estatísticas inline — mobile/tablet */}
          <div className="mt-8 flex flex-wrap gap-5 lg:hidden">
            {stats.map(({ icon: Icon, value, prefix, suffix, decimals, label }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground"><StatCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} /></div>
                  <div className="max-w-32 text-[11px] text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Coluna de imagem */}
        <motion.div className="relative z-10 flex items-center justify-center lg:justify-end" initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2, ease }}>
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl">

            {/* Imagem — ~10% menor */}
            <img
              src={HERO_IMAGE}
              alt="Equipamento de fotografia e vídeo disponível para arrendar na Beeznoo"
              className="h-105 w-full object-cover sm:h-115 lg:h-125"
            />

            {/* Camada desfocada */}
            <img
              src={HERO_IMAGE}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-105 w-full scale-105 object-cover blur-lg sm:h-115 lg:h-125"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 65% 55% at 42% 68%, transparent 35%, black 75%)",
                maskImage:
                  "radial-gradient(ellipse 65% 55% at 42% 68%, transparent 35%, black 75%)",
              }}
            />

            {/* Nota manuscrita */}
            <span
              className="absolute left-8 top-8 rotate-[-4deg] font-serif text-base italic text-primary-foreground/90 sm:text-lg lg:text-xl"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
            >
              Mais
              <br />
              liberdade
              <br />
              para criar
            </span>

            {/* Card flutuante */}
            <motion.div className="absolute bottom-5 right-5 flex items-center gap-2.5 rounded-2xl bg-accent px-3.5 py-2.5 text-accent-foreground shadow-lg backdrop-blur-sm" whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-accent-foreground">
                <Leaf className="h-3.5 w-3.5" />
              </span>
              <span className="max-w-36 text-[11px] leading-snug">
                Equipamentos que impulsionam os teus projetos.
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </motion.div>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {contactModalOpen && <ContactModal setContactModalOpen={setContactModalOpen} abrirWhatsapp={abrirWhatsapp}/>}
      </AnimatePresence>
    </motion.section>
  );
}
