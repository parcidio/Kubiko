import { MapPinOff } from "lucide-react";
import { HexGlow, Logo } from "@/components/bz/brand";
import { HexTile } from "@/components/bz/hex";
import { ButtonLink } from "@/components/bz/ui";

export default function NotFound() {
  return (
    <div className="app relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-verde-noite px-4 text-center text-areia">
      <HexGlow />
      <div className="relative grid animate-sobe justify-items-center gap-5">
        <Logo dark href="/" />
        <HexTile icon={MapPinOff} tone="salvia" size={88} flip className="mt-4" />
        <p className="num font-titulo text-[64px] leading-none font-extrabold tracking-[-0.025em] text-salvia">404</p>
        <h1 className="font-titulo text-[26px] font-bold tracking-tight text-white">Esta página não existe</h1>
        <p className="max-w-sm text-salvia-tint">Pode ter mudado de sítio, ou o equipamento já não está disponível.</p>
        <ButtonLink href="/explorar" size="lg" arrow>
          Explorar equipamento
        </ButtonLink>
      </div>
    </div>
  );
}
