"use client";

import { useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, Clock, ScanFace, UserRound } from "lucide-react";
import { HexTile } from "@/components/bz/hex";
import { LocationOptIn } from "@/components/bz/location";
import { toast } from "@/components/bz/overlay";
import { CameraSlot } from "@/components/bz/photo";
import { PageHeader, StickyCTA } from "@/components/bz/shell";
import { ErrorState } from "@/components/bz/states";
import { SuccessCheck } from "@/components/bz/success";
import { SegmentedControl } from "@/components/bz/tabs";
import { BackLink, Button, ButtonLink, Callout, Card, Skeleton } from "@/components/bz/ui";
import { kycApi } from "@/lib/api";
import { locationApi } from "@/lib/api-ops";
import type { ApproxLocation } from "@/lib/location";
import { useRequireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { compressImage } from "@/lib/images";
import type { KycAccountType, KycStatusInfo } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { fmt } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";

type Slot = "biFront" | "biBack" | "selfie" | "nifDocument" | "businessDocument";
const REQUIRED: Record<KycAccountType, Slot[]> = {
  INDIVIDUAL: ["biFront", "biBack", "selfie"],
  BUSINESS: ["nifDocument", "businessDocument"],
};
// SLOT_LABEL (t.verification.slots): diz o que falta debaixo do botão, em vez de o deixar só cinzento.
// DELAY (t.verification.delay): a verificação é manual (decisoes-produto.md 2026-11-15) — dizê-lo antes e depois do envio.

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
  const [location, setLocation] = useState<ApproxLocation | null>(null);
  const dict = useT();
  const lang = useLang();
  const t = dict.verification;
  const SLOT_LABEL = t.slots;
  const DELAY = t.delay;

  if (!session) return null;
  if (status.error) return <ErrorState message={status.error} onRetry={status.reload} />;
  if (status.loading || !status.data) return <Skeleton role="status" aria-label={dict.common.loading} className="mx-auto h-96 max-w-2xl rounded-sheet" />;

  const k = status.data;

  if (k.status === "APPROVED") {
    return (
      <Result tone="ok" title={t.approvedTitle}>
        {t.approvedText}
      </Result>
    );
  }

  if (k.status === "PENDING" || k.status === "IN_REVIEW") {
    return (
      // Acabou de enviar (PENDING) = sucesso; IN_REVIEW = a equipa já está a ver (prazo, não sucesso)
      <Result tone={k.status === "IN_REVIEW" ? "ambar" : "ok"} title={k.status === "IN_REVIEW" ? t.reviewingTitle : t.pendingTitle}>
        {DELAY} {t.notify}
        {k.submittedAt && <span className="mt-2 block text-[13px]">{fmt(t.sentAt, { when: formatDateTime(k.submittedAt, lang) })}</span>}
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
  const missing = REQUIRED[type].filter((s) => !files[s]).map((s) => SLOT_LABEL[s]);

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
      toast.success(t.sent);
      // opcional: só com consentimento; uma falha aqui não estraga o envio
      if (location) locationApi.report({ ...location, context: "KYC" }).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.sendError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-24">
      <BackLink href="/conta">{t.back}</BackLink>
      <div className="grid justify-items-start gap-4">
        <HexTile icon={BadgeCheck} tone="salvia" size={64} flip className="animate-sobe" />
        <PageHeader title={t.title} subtitle={t.subtitle} />
      </div>

      {k.status === "REJECTED" && (
        <Callout tone="erro" icon={AlertTriangle} title={t.rejectedTitle}>
          {k.rejectionReason ?? t.sendAgain}
        </Callout>
      )}
      {k.status === "INFO_REQUESTED" && (
        <Callout tone="warn" icon={AlertTriangle} title={t.infoTitle}>
          {k.infoRequestNote ?? t.sendAgain}
        </Callout>
      )}

      <Callout tone="ok" icon={BadgeCheck} title={t.whyTitle}>
        {t.whyText}{" "}
        <a href="/privacidade" target="_blank" className="font-medium underline">{t.privacyLink}</a>.
      </Callout>
      <Callout tone="info" icon={Clock} title={t.manualTitle}>
        {DELAY}
      </Callout>

      {k.status !== "INFO_REQUESTED" && (
        <SegmentedControl
          label={t.accountType}
          value={kind}
          onChange={setKind}
          options={[
            { value: "INDIVIDUAL", label: t.individual },
            { value: "BUSINESS", label: t.business },
          ]}
        />
      )}

      {/* Fundo escuro: as fotos dos documentos leem-se melhor */}
      <Card className="superficie-marca grid gap-4 border-0 bg-verde-noite p-4 text-areia">
        {type === "INDIVIDUAL" ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <UserRound className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> {t.idCard}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label={t.biFront.label} hint={t.biFront.hint} photo={previews.biFront} onPick={pick("biFront")} />
              <CameraSlot label={t.biBack.label} hint={t.biBack.hint} photo={previews.biBack} onPick={pick("biBack")} />
            </div>
            <p className="flex items-center gap-2 pt-2 font-bold">
              <ScanFace className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> {t.selfieTitle}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label={t.selfie.label} hint={t.selfie.hint} photo={previews.selfie} onPick={pick("selfie")} capture="user" />
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-bold">
              <Building2 className="size-5 text-ambar" strokeWidth={1.8} aria-hidden /> {t.companyDocs}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CameraSlot label={t.nif.label} hint={t.nif.hint} photo={previews.nifDocument} onPick={pick("nifDocument")} />
              <CameraSlot label={t.business2.label} hint={t.business2.hint} photo={previews.businessDocument} onPick={pick("businessDocument")} />
            </div>
          </>
        )}
      </Card>

      <LocationOptIn value={location} onChange={setLocation} />

      <StickyCTA>
        <Button size="lg" block disabled={!ready} loading={sending} onClick={submit} aria-describedby={ready ? undefined : "kyc-falta"}>
          {t.submit}
        </Button>
        {!ready && (
          <p id="kyc-falta" className="mt-1.5 text-center text-[13px] text-cinza">
            {fmt(missing.length > 1 ? t.missingMany : t.missingOne, { list: missing.join(", ").replace(/, ([^,]*)$/, `${t.and}$1`) })}
          </p>
        )}
      </StickyCTA>
    </div>
  );
}

function Result({ tone, title, children }: { tone: "ok" | "ambar"; title: string; children: React.ReactNode }) {
  const t = useT().verification;
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-10 text-center">
      {tone === "ok" ? <SuccessCheck /> : <HexTile icon={Clock} tone="ambar-tint" size={88} />}
      <h1 className="animate-sobe font-titulo text-[28px] leading-tight font-bold tracking-[-0.02em] text-verde [animation-delay:150ms]">{title}</h1>
      <p className="animate-sobe text-texto-corpo [animation-delay:200ms]">{children}</p>
      <ButtonLink href="/explorar" variant="dark" arrow className="mt-2">
        {t.explore}
      </ButtonLink>
    </div>
  );
}
