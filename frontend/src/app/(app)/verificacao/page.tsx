"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, Clock, ScanFace, UserRound } from "lucide-react";
import { HexIllustration } from "@/components/bz/brand";
import { toast } from "@/components/bz/overlay";
import { CameraSlot } from "@/components/bz/photo";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Skeleton } from "@/components/bz/ui";
import { kycApi } from "@/lib/api";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { compressImage } from "@/lib/images";
import type { KycAccountType, KycStatusInfo } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type Slot = "biFront" | "biBack" | "selfie" | "nifDocument" | "businessDocument";
const REQUIRED: Record<KycAccountType, Slot[]> = {
  INDIVIDUAL: ["biFront", "biBack", "selfie"],
  BUSINESS: ["nifDocument", "businessDocument"],
};

/** A verificação é manual (decisoes-produto.md 2026-11-15) — dizê-lo antes e depois do envio. */
const DELAY = "A verificação é feita à mão pela equipa Beeznoo e pode demorar até 2 dias úteis.";

/**
 * KYC manual (SPEC §7): particular = BI frente/verso + selfie com o BI · empresa = documento do NIF + certidão/alvará.
 * A equipa decide em Admin › Verificações. Os ficheiros vão para armazenamento privado.
 */
export default function VerificacaoPage() {
  const session = useRequireSession();
  const status = useResource<KycStatusInfo>(session ? "kyc:me" : null, () => kycApi.me());
  const [kind, setKind] = useState<KycAccountType>("INDIVIDUAL");
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [sending, setSending] = useState(false);

  if (!session) return null;
  if (status.error) return <ErrorState message={status.error} onRetry={status.reload} />;
  if (status.loading || !status.data) return <Skeleton role="status" aria-label="A carregar" className="mx-auto h-96 max-w-2xl rounded-sheet" />;

  const k = status.data;

  if (k.status === "APPROVED") {
    return (
      <Result icon={BadgeCheck} tone="ok" title="Identidade verificada">
        Já podes pedir reservas e publicar equipamento. O selo &quot;Verificado&quot; aparece no teu perfil.
      </Result>
    );
  }

  if (k.status === "PENDING" || k.status === "IN_REVIEW") {
    return (
      <Result icon={Clock} tone="ambar" title={k.status === "IN_REVIEW" ? "A equipa está a verificar" : "Em análise"}>
        {DELAY} Avisamos-te na app e por email quando houver decisão.
        {k.submittedAt && <span className="mt-2 block text-[13px]">Enviado a {formatDateTime(k.submittedAt)}.</span>}
      </Result>
    );
  }

  // Sem verificação, recusada ou com pedido de informação → formulário
  const pick = (slot: Slot) => (f: File) => {
    setFiles((s) => ({ ...s, [slot]: f }));
    setPreviews((p) => {
      if (p[slot]) URL.revokeObjectURL(p[slot]!);
      return { ...p, [slot]: URL.createObjectURL(f) };
    });
  };
  const type = k.status === "INFO_REQUESTED" && k.accountType ? k.accountType : kind;
  const ready = REQUIRED[type].every((s) => files[s]);

  async function submit() {
    setSending(true);
    try {
      const payload: Partial<Record<Slot, Blob>> = {};
      for (const slot of REQUIRED[type]) {
        const f = files[slot]!;
        // fotos reduzidas (rede móvel, limite de 5 MB) mas legíveis; PDFs seguem como estão
        payload[slot] = f.type === "application/pdf" ? f : await compressImage(f, 2200, 0.85);
      }
      status.setData(await kycApi.submit(type, payload));
      toast.success("Documentos enviados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar os documentos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-24">
      <BackLink href="/conta">Voltar à conta</BackLink>
      <PageHeader title="Verifica a tua identidade" subtitle="Obrigatório antes de pedir uma reserva ou publicar. Enviar leva 2 minutos." />

      {k.status === "REJECTED" && (
        <Callout tone="erro" icon={AlertTriangle} title="A verificação anterior foi recusada">
          {k.rejectionReason ?? "Envia os documentos outra vez."}
        </Callout>
      )}
      {k.status === "INFO_REQUESTED" && (
        <Callout tone="warn" icon={AlertTriangle} title="A equipa pediu mais informação">
          {k.infoRequestNote ?? "Envia os documentos outra vez."}
        </Callout>
      )}

      <Callout tone="ok" icon={BadgeCheck} title="Porque pedimos isto">
        Quem aluga sabe com quem está a lidar. Os documentos ficam guardados de forma privada e só a equipa Beeznoo os vê.{" "}
        <a href="/privacidade" target="_blank" className="font-medium underline">Como tratamos os teus dados</a>.
      </Callout>
      <Callout tone="info" icon={Clock} title="Não é automático">
        {DELAY}
      </Callout>

      {k.status !== "INFO_REQUESTED" && (
        <Segmented
          label="Tipo de conta"
          value={kind}
          onChange={setKind}
          options={[
            { value: "INDIVIDUAL", label: "Particular" },
            { value: "BUSINESS", label: "Empresa" },
          ]}
        />
      )}

      {/* Fundo escuro: as fotos dos documentos leem-se melhor */}
      <Card className="grid gap-4 border-0 bg-verde-noite p-4 text-areia">
        {type === "INDIVIDUAL" ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <UserRound className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Bilhete de Identidade
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="BI — frente" hint="Os 4 cantos visíveis, sem reflexos" photo={previews.biFront} onPick={pick("biFront")} />
              <CameraSlot label="BI — verso" hint="Texto legível" photo={previews.biBack} onPick={pick("biBack")} />
            </div>
            <p className="flex items-center gap-2 pt-2 font-bold">
              <ScanFace className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Selfie
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="Selfie com o BI" hint="Cara e BI na mesma foto" photo={previews.selfie} onPick={pick("selfie")} capture="user" />
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-bold">
              <Building2 className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> Documentos da empresa
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label="Documento do NIF" hint="Cartão ou declaração com o NIF" photo={previews.nifDocument} onPick={pick("nifDocument")} />
              <CameraSlot label="Certidão ou alvará" hint="Registo comercial da empresa" photo={previews.businessDocument} onPick={pick("businessDocument")} />
            </div>
          </>
        )}
      </Card>

      <StickyCTA>
        <Button size="lg" block disabled={!ready} loading={sending} onClick={submit}>
          Enviar para verificação
        </Button>
      </StickyCTA>
    </div>
  );
}

function Result({ icon, tone, title, children }: { icon: typeof Clock; tone: "ok" | "ambar"; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
      <HexIllustration icon={icon} tone={tone} size={150} />
      <h1 className="font-titulo text-3xl font-extrabold text-verde">{title}</h1>
      <p className="text-cinza">{children}</p>
      <ButtonLink href="/explorar" variant="dark">
        Explorar equipamento
      </ButtonLink>
    </div>
  );
}
