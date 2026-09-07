import { Search, ArrowRight, Package, Camera, Video, Mic, Sparkles, Plane, Plus, Shield, Star, Leaf } from "lucide-react";

// Troca por uma foto tua — de preferência com o objeto principal
// posicionado perto do centro-inferior, é onde a máscara mantém nitidez.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop";

const categories = [
  { label: "Fotografia", icon: Camera },
  { label: "Vídeo", icon: Video },
  { label: "Áudio", icon: Mic },
  { label: "Eventos", icon: Sparkles },
  { label: "Drone", icon: Plane },
];

const stats = [
  { icon: Package, value: "+200", label: "Equipamentos disponíveis" },
  { icon: Shield, value: "100%", label: "Transações seguras" },
  { icon: Star, value: "4.8", label: "Avaliação média (baseada em 300+ reviews)" },
];

export default function KubikoHero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#FBF9F4]">
      {/* curva verde no fundo */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[#1F3A2E] sm:h-56 lg:h-64"
        style={{ clipPath: "ellipse(65% 100% at 15% 100%)" }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-8 lg:px-10">
        {/* Coluna de texto */}
        <div className="relative z-10 flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#E4DFD3] bg-white px-4 py-1.5 text-sm text-[#4A4A45]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D45]" />
            Aluguer de equipamentos em Luanda
          </div>

          <h1 className="text-[2.6rem] font-semibold leading-[1.08] text-[#1A1A18] sm:text-5xl lg:text-[3.2rem]">
            Para quem precisa
            <br />
            <span className="text-[#2F6B4F]">usar</span>, não precisa
            <br />
            possuir.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#6B6B63]">
            Na Kubiko, encontras e alugas equipamentos de qualidade para
            fotografia, vídeo, áudio, eventos e muito mais. Tudo de forma
            simples, segura e perto de ti.
          </p>

          {/* Barra de pesquisa */}
          <div className="mt-7 flex max-w-lg items-center gap-2 rounded-full border border-[#E4DFD3] bg-white p-1.5 pl-4 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-[#9B9B93]" />
            <input
              type="text"
              placeholder="O que procuras hoje?"
              className="w-full bg-transparent text-sm text-[#1A1A18] placeholder:text-[#9B9B93] focus:outline-none"
            />
            <button className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1F3A2E] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#16291F]">
              Pesquisar
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Chips de categorias */}
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2 text-sm text-[#3A3A36] transition-colors hover:border-[#2F6B4F] hover:text-[#2F6B4F]"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button className="flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-white px-4 py-2 text-sm text-[#3A3A36] transition-colors hover:border-[#2F6B4F] hover:text-[#2F6B4F]">
              <Plus className="h-3.5 w-3.5" />
              Mais
            </button>
          </div>

          {/* Estatísticas */}
          <div className="mt-9 flex flex-wrap gap-8">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF1EC] text-[#2F6B4F]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="font-semibold text-[#1A1A18]">{value}</div>
                  <div className="max-w-[9rem] text-xs text-[#8A8A82]">{label}</div>
                </div>
              </div>
            ))}
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
              className="absolute left-10 top-10 rotate-[-4deg] font-serif text-lg italic text-[#EAF1EC]"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
            >
              Mais
              <br />
              liberdade
              <br />
              para criar
            </span>

            {/* card flutuante */}
            <div className="absolute bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-[#1F3A2E]/95 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
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