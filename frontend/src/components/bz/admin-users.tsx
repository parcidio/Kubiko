import { Badge, type Tone } from "./ui";
import type { KycStatus, UserRole } from "@/lib/types";

/** Peças de Admin › Utilizadores (decisoes-produto.md 2026-11-15 — ações de admin). */

const KYC: Record<KycStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "KYC por analisar", tone: "pendente" },
  IN_REVIEW: { label: "KYC em análise", tone: "analise" },
  INFO_REQUESTED: { label: "KYC: falta info", tone: "pendente" },
  APPROVED: { label: "Verificado", tone: "ok" },
  REJECTED: { label: "KYC recusado", tone: "erro" },
};

export function KycBadge({ status }: { status: KycStatus | null }) {
  if (!status) return <Badge tone="neutro">Sem KYC</Badge>;
  const k = KYC[status];
  return <Badge tone={k.tone}>{k.label}</Badge>;
}

const ROLE: Record<UserRole, string> = { OWNER: "dono", RENTER: "arrendatário", BOTH: "dono e arrendatário", ADMIN: "equipa" };

export function RoleLabel({ role }: { role: UserRole }) {
  return <>{ROLE[role] ?? role}</>;
}

export const ITEM_STATUS: Record<"ACTIVE" | "INACTIVE" | "SUSPENDED", { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "ok" },
  INACTIVE: { label: "Pausado pelo dono", tone: "neutro" },
  SUSPENDED: { label: "Suspenso pela equipa", tone: "erro" },
};
