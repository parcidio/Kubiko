"use client";

import { useState } from "react";
import { BadgeCheck, Building2, Clock, ScanFace, UserRound } from "lucide-react";
import { HexIllustration } from "@/components/bz/brand";
import { TextField } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { CameraSlot } from "@/components/bz/photo";
import { PageHeader } from "@/components/bz/shell";
import { BackendPending } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { Button, Callout, Card } from "@/components/bz/ui";
import { useRequireSession } from "@/lib/auth";

type Kind = "individual" | "business";

/** KYC manual (SPEC §7): particular = BI frente/verso + selfie · empresa = NIF + documento. */
export default function VerificacaoPage() {
  const session = useRequireSession();
  const [kind, setKind] = useState<Kind>("individual");
  const [shots, setShots] = useState<Record<string, string>>({});
  const [nif, setNif] = useState("");
  const [sent, setSent] = useState(false);

  if (!session) return null;
  const pick = (key: string) => (f: File) => setShots((s) => ({ ...s, [key]: URL.createObjectURL(f) }));
  const ready = kind === "individual" ? ["bi-frente", "bi-verso", "selfie"].every((k) => shots[k]) : nif.length >= 9 && !!shots["doc"];

  if (sent) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
        <HexIllustration icon={Clock} tone="ambar" size={150} />
        <h1 className="font-titulo text-3xl font-extrabold text-verde">Em análise</h1>
        <p className="text-cinza">A equipa confirma os teus documentos, normalmente no mesmo dia. Avisamos-te por SMS.</p>
        <BackendPending what="A submissão de documentos KYC ainda não tem endpoint: nada foi enviado." />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <PageHeader title="Verifica a tua identidade" subtitle="Obrigatório antes de pedir uma reserva ou publicar. Leva 2 minutos." />
      <Callout tone="ok" icon={BadgeCheck} title="Porque pedimos isto">
        Quem aluga sabe com quem está a lidar. Os documentos ficam guardados de forma privada e só a equipa Beeznoo os vê.
      </Callout>

      <Segmented
        label="Tipo de conta"
        value={kind}
        onChange={setKind}
        options={[
          { value: "individual", label: "Particular" },
          { value: "business", label: "Empresa" },
        ]}
      />

      {/* Fundo escuro: as fotos dos documentos leem-se melhor */}
      <Card className="grid gap-4 border-0 bg-verde-noite p-4 text-areia">
        {kind === "individual" ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <UserRound className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Bilhete de Identidade
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="BI — frente" hint="Os 4 cantos visíveis, sem reflexos" photo={shots["bi-frente"]} onPick={pick("bi-frente")} />
              <CameraSlot label="BI — verso" hint="Texto legível" photo={shots["bi-verso"]} onPick={pick("bi-verso")} />
            </div>
            <p className="flex items-center gap-2 pt-2 font-bold">
              <ScanFace className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Selfie
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="Selfie com o BI" hint="Cara e BI na mesma foto" photo={shots["selfie"]} onPick={pick("selfie")} />
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-bold">
              <Building2 className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Dados da empresa
            </p>
            <div className="[&_input]:border-white/20 [&_input]:bg-white/5 [&_input]:text-areia [&_label]:text-areia">
              <TextField label="NIF" value={nif} onChange={(v) => setNif(v.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" placeholder="Ex.: 5417000000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="Certidão ou alvará" hint="Documento com o NIF" photo={shots["doc"]} onPick={pick("doc")} />
            </div>
          </>
        )}
      </Card>

      <BackendPending what="Upload privado de documentos KYC e estados (em análise, aprovado, recusado, pedir mais informação)." />
      <Button
        size="lg"
        block
        disabled={!ready}
        onClick={() => {
          toast("Ainda não é enviado: falta o backend de verificação.");
          setSent(true);
        }}
      >
        Enviar para verificação
      </Button>
    </div>
  );
}
