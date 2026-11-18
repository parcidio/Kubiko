"use client";

import { AlertTriangle, BadgeCheck, Clock, FileText, Lock, ScanFace, type LucideIcon } from "lucide-react";
import { HexTile, type HexTone } from "./hex";
import { ButtonLink } from "./ui";
import { kycApi, profileApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { useLang, useT } from "@/lib/i18n/client";
import type { KycStatusInfo } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

/** Onde o cartão aparece: muda só o título do estado "por começar" (porquê agora). */
export type KycContext = "account" | "dashboard" | "publish" | "request";

type View = "none" | "pending" | "rejected" | "info" | "approved";

function viewOf(k: KycStatusInfo): View {
  switch (k.status) {
    case "APPROVED":
      return "approved";
    case "PENDING":
    case "IN_REVIEW":
      return "pending";
    case "REJECTED":
      return "rejected";
    case "INFO_REQUESTED":
      return "info";
    default:
      return "none";
  }
}

const LOOK: Record<View, { icon: LucideIcon; tone: HexTone; box: string }> = {
  none: { icon: BadgeCheck, tone: "verde", box: "border-borda bg-branco" },
  pending: { icon: Clock, tone: "ambar-tint", box: "border-borda bg-branco" },
  rejected: { icon: AlertTriangle, tone: "erro", box: "border-erro/40 bg-branco" },
  info: { icon: AlertTriangle, tone: "ambar-tint", box: "border-borda bg-branco" },
  approved: { icon: BadgeCheck, tone: "salvia-tint", box: "border-borda bg-branco" },
};

/** Lê /kyc/me e mostra o cartão. Sem nada enquanto carrega ou se falhar: é um aviso, não bloqueia o ecrã. */
export function KycCard({ context = "account", primary = false, className }: { context?: KycContext; primary?: boolean; className?: string }) {
  const kyc = useResource<KycStatusInfo>("kyc:me", () => kycApi.me());
  // Nos momentos com gate (publicar, pedir): se o servidor não exige KYC (KYC_REQUIRED=false), não diz "obrigatório"
  const gated = context === "publish" || context === "request";
  const me = useResource(gated ? "profile:me" : null, () => profileApi.me());
  if (!kyc.data || (gated && !me.data)) return null;
  if (gated && me.data?.canTransact) return null;
  return <KycStatusCard kyc={kyc.data} context={context} primary={primary} className={className} />;
}

/**
 * "Verifica a tua identidade" — o próximo passo visível (DESIGN_SYSTEM: NextStepCard). Diz o que é, porquê, quanto
 * demora e o que é preciso; muda com o estado: por começar · em análise · recusada (motivo + reenviar) · falta
 * informação · verificada. `primary` = botão âmbar (só quando é a única ação do ecrã).
 */
export function KycStatusCard({ kyc, context = "account", primary = false, className }: { kyc: KycStatusInfo; context?: KycContext; primary?: boolean; className?: string }) {
  const t = useT().kycCard;
  const lang = useLang();
  const view = viewOf(kyc);
  // Verificada: só na Conta (confirmação); nos outros ecrãs já não há nada a fazer
  if (view === "approved" && context !== "account") return null;
  const look = LOOK[view];

  const title =
    view === "none" ? t.titles[context] : view === "pending" ? t.pending.title : view === "rejected" ? t.rejected.title : view === "info" ? t.info.title : t.approved.title;

  return (
    <section aria-label={t.label} className={cn("grid animate-sobe gap-4 rounded-cartao border p-4 md:p-5", look.box, className)}>
      <div className="flex items-start gap-3">
        <HexTile icon={look.icon} tone={look.tone} size={44} />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-xs font-bold tracking-[0.1em] text-cinza uppercase">{t.label}</p>
          <h2 className="font-titulo text-lg leading-tight font-bold text-verde md:text-xl">{title}</h2>
          {view === "none" && <p className="text-[15px] text-texto-corpo">{t.why}</p>}
          {view === "pending" && (
            <p className="text-[15px] text-texto-corpo">
              {kyc.submittedAt ? fmt(t.pending.textAt, { when: formatDateTime(kyc.submittedAt, lang) }) : t.pending.text}
            </p>
          )}
          {view === "rejected" && (
            <p className="text-[15px] text-texto-corpo">
              {kyc.rejectionReason ? (
                <>
                  <span className="font-medium text-verde">{t.reasonLabel}</span> {kyc.rejectionReason}
                </>
              ) : (
                t.rejected.text
              )}
            </p>
          )}
          {view === "info" && (
            <p className="text-[15px] text-texto-corpo">
              {kyc.infoRequestNote ? (
                <>
                  <span className="font-medium text-verde">{t.info.noteLabel}</span> {kyc.infoRequestNote}
                </>
              ) : (
                t.info.text
              )}
            </p>
          )}
          {view === "approved" && <p className="text-[15px] text-texto-corpo">{t.approved.text}</p>}
        </div>
      </div>

      {(view === "none" || view === "rejected" || view === "info") && (
        <ul className="grid gap-2 text-sm text-texto-corpo sm:grid-cols-3">
          <Fact icon={ScanFace}>{t.facts.needs}</Fact>
          <Fact icon={Clock}>{t.facts.time}</Fact>
          <Fact icon={Lock}>{t.facts.privacy}</Fact>
        </ul>
      )}

      {view !== "pending" && view !== "approved" && (
        <ButtonLink href="/verificacao" variant={primary ? "primary" : "dark"} arrow className="justify-self-start">
          {view === "none" ? t.start : view === "rejected" ? t.rejected.cta : t.info.cta}
        </ButtonLink>
      )}
      {view === "pending" && (
        <p className="flex items-center gap-2 text-[13px] text-cinza">
          <FileText className="size-4" strokeWidth={1.8} aria-hidden /> {t.pending.notify}
        </p>
      )}
    </section>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-campo bg-areia px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-verde-medio" strokeWidth={1.8} aria-hidden />
      <span>{children}</span>
    </li>
  );
}
