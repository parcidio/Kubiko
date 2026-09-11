import { ArrowRight, Package, Camera, Video, Mic, Sparkles, Plane, Plus, Shield, Star, Leaf } from "lucide-react";

// Troca por uma foto tua — de preferência com o objeto principal
// posicionado perto do centro-inferior, é onde a máscara mantém nitidez.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop";

const stats = [
  { icon: Package, value: "+200", label: "Equipamentos disponíveis" },
  { icon: Shield, value: "100%", label: "Transações seguras" },
  { icon: Star, value: "4.8", label: "Avaliação média (baseada em 300+ reviews)" },
];

export default function BeeznoHero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-background">
      {/* curva verde no fundo */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-primary sm:h-56 lg:h-64"
        style={{ clipPath: "ellipse(65% 80% at 30% 100%)" }}
      />
      {/* Estatísticas */}
          <div className="absolute bottom-10 left-10 z-10 flex flex-wrap gap-8">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="font-semibold text-primary-foreground">{value}</div>
                  <div className="max-w-[9rem] text-xs text-primary-foreground/60">{label}</div>
                </div>
              </div>
            ))}
          </div>

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-8 lg:px-10">
        {/* Coluna de texto */}
        <div className="relative z-10 flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#E4DFD3] bg-white px-4 py-1.5 text-sm text-[#4A4A45]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D45]" />
            Aluguer de equipamentos em Luanda
          </div>

          <h1 className="text-[2.6rem] font-semibold leading-[1.08] text-foreground sm:text-5xl lg:text-[3.2rem]">
            Para quem precisa
            <br />
            <span className="text-primary/90">usar</span>, não precisa
            <br />
            possuir.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-foreground/80 sm:text-base lg:max-w-lg lg:text-lg">
            Na Beeznoo, encontras e alugas equipamentos de qualidade para
            fotografia, vídeo, áudio, eventos e muito mais. Tudo de forma
            simples, segura e perto de ti.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex max-w-lg flex items-center gap-4 p-1.5 pl-4 justify-start">
            <button className="bg-primary rounded-md w-50 h-10 cursor-pointer text-primary-foreground font-semibold">
              Explorar items
            </button>
            <button className="bg-secondary border border-border-bg rounded-md w-50 h-10 cursor-pointer text-secondary-foreground font-semibold">
              Publicar o meu item
            </button>
          </div>
        </div>

        {/* Coluna de imagem */}
        <div className="relative z-10 flex items-center justify-center lg:justify-end">
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl">
            {/* camada nítida (base) — o equipamento em primeiro plano */}
            <img
              src={HERO_IMAGE}
              alt="Equipamento de fotografia e vídeo disponível para arrendar na Kubiko"
              className="h-[520px] w-full object-cover sm:h-[560px] lg:h-[600px]"
            />

            {/* camada desfocada por cima — simula profundidade de campo.
                A máscara radial "apaga" o blur exatamente onde está o
                equipamento, deixando o fundo (parede, planta, quadro) desfocado. */}
            <img
              src={HERO_IMAGE}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-[520px] w-full scale-105 object-cover blur-lg sm:h-[560px] lg:h-[600px]"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 65% 55% at 42% 68%, transparent 35%, black 75%)",
                maskImage:
                  "radial-gradient(ellipse 65% 55% at 42% 68%, transparent 35%, black 75%)",
              }}
            />

            {/* nota manuscrita */}
            <span
              className="absolute left-10 top-10 rotate-[-4deg] font-serif text-lg italic text-primary-foreground/90 sm:text-xl lg:text-2xl"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
            >
              Mais
              <br />
              liberdade
              <br />
              para criar
            </span>

            {/* card flutuante */}
            <div className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-foreground shadow-lg backdrop-blur-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-accent-foreground">
                <Leaf className="h-4 w-4" />
              </span>
              <span className="max-w-[10rem] text-xs leading-snug">
                Equipamentos que impulsionam os teus projetos.
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}