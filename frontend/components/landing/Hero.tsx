import { ArrowRight, Package, Shield, Star, Leaf } from "lucide-react";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop";

const stats = [
  { icon: Package, value: "+200", label: "Equipamentos disponíveis" },
  { icon: Shield,  value: "100%", label: "Transações seguras" },
  { icon: Star,    value: "4.8",  label: "Avaliação média (baseada em 300+ reviews)" },
];

export default function BeeznoHero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-background">

      {/* Curva — ~10% menor */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-primary sm:h-48 lg:h-56"
        style={{ clipPath: "ellipse(65% 60% at 30% 100%)" }}
      />

      {/* Estatísticas */}
      <div className="absolute bottom-8 left-8 z-10 flex flex-wrap gap-6 lg:flex hidden">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-primary-foreground">{value}</div>
              <div className="max-w-[8rem] text-[11px] text-primary-foreground/60">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid — padding e gap reduzidos */}
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-10 lg:grid-cols-2 lg:gap-6 lg:px-10 lg:py-12">

        {/* Coluna de texto */}
        <div className="relative z-10 flex flex-col justify-center">

          {/* Badge */}
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#E4DFD3] bg-white px-3.5 py-1 text-xs text-[#4A4A45]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D45]" />
            Aluguer de equipamentos em Luanda
          </div>

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

          {/* CTAs */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="cursor-pointer rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Explorar items
            </button>
            <button className="cursor-pointer rounded-md border border-border-bg bg-secondary px-5 py-2 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-80">
              Publicar o meu item
            </button>
          </div>

          {/* Estatísticas inline — mobile/tablet */}
          <div className="mt-8 flex flex-wrap gap-5 lg:hidden">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">{value}</div>
                  <div className="max-w-[8rem] text-[11px] text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna de imagem */}
        <div className="relative z-10 flex items-center justify-center lg:justify-end">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl">

            {/* Imagem — ~10% menor */}
            <img
              src={HERO_IMAGE}
              alt="Equipamento de fotografia e vídeo disponível para arrendar na Beeznoo"
              className="h-[420px] w-full object-cover sm:h-[460px] lg:h-[500px]"
            />

            {/* Camada desfocada */}
            <img
              src={HERO_IMAGE}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-[420px] w-full scale-105 object-cover blur-lg sm:h-[460px] lg:h-[500px]"
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
            <div className="absolute bottom-5 right-5 flex items-center gap-2.5 rounded-2xl bg-accent px-3.5 py-2.5 text-accent-foreground shadow-lg backdrop-blur-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-accent-foreground">
                <Leaf className="h-3.5 w-3.5" />
              </span>
              <span className="max-w-[9rem] text-[11px] leading-snug">
                Equipamentos que impulsionam os teus projetos.
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}