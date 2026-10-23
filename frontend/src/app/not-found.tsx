import { MapPinOff } from "lucide-react";
import { HexGlow, HexIllustration, Logo } from "@/components/bz/brand";
import { ButtonLink } from "@/components/bz/ui";

export default function NotFound() {
  return (
    <div className="app relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-verde-noite px-4 text-center text-areia">
      <HexGlow />
      <div className="relative grid justify-items-center gap-5">
        <Logo dark href="/" />
        <HexIllustration icon={MapPinOff} tone="escuro" size={168} />
        <p className="font-titulo text-[64px] leading-none font-extrabold text-ambar">404</p>
        <h1 className="font-titulo text-2xl font-bold">Esta página não existe</h1>
        <p className="max-w-sm text-areia/75">Pode ter mudado de sítio, ou o equipamento já não está disponível.</p>
        <ButtonLink href="/explorar" size="lg">Explorar equipamento</ButtonLink>
      </div>
    </div>
  );
}
