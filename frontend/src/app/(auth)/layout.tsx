import { BadgeCheck, ShieldCheck, Ticket } from "lucide-react";
import { HexGlow, Logo } from "@/components/bz/brand";

const PROMISES = [
  { icon: BadgeCheck, text: "Donos e arrendatários verificados" },
  { icon: ShieldCheck, text: "Caução devolvida quando tudo corre bem" },
  { icon: Ticket, text: "Pagas por referência Multicaixa" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app min-h-dvh md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Herói: faixa no telemóvel, painel inteiro no desktop */}
      <aside className="relative overflow-hidden bg-verde-noite px-4 pt-5 pb-14 text-areia md:flex md:min-h-dvh md:flex-col md:justify-between md:px-12 md:py-10">
        <HexGlow />
        <div className="relative">
          <Logo dark href="/" />
        </div>
        <div className="relative mt-8 grid gap-4 md:mt-0">
          <p className="font-titulo text-[34px] leading-[1] font-extrabold tracking-tight md:text-[56px]">
            Por que comprar quando podes <span className="text-ambar">alugar?</span>
          </p>
          <ul className="hidden gap-3 md:grid">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-areia/85">
                <Icon className="size-5 text-ambar" strokeWidth={1.8} aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-[13px] text-areia/60 md:block">Equipamento de fotografia, vídeo e eventos em Luanda.</p>
      </aside>
      <main className="relative -mt-8 rounded-t-sheet bg-areia px-4 pt-8 pb-12 md:mt-0 md:flex md:items-center md:rounded-none md:px-12">
        <div className="mx-auto w-full max-w-md animate-sobe">{children}</div>
      </main>
    </div>
  );
}
