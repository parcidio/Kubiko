"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollText, ShieldAlert, X } from "lucide-react";
import { AdminHeader } from "@/components/bz/admin";
import { SelectField, TextField } from "@/components/bz/form";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/bz/states";
import { Segmented } from "@/components/bz/tabs";
import { Badge, Button, Card, type Tone } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { bookingCode } from "@/lib/booking";
import { formatDateTime } from "@/lib/format";
import type { AuditLog, Page, SecurityEvent, SecuritySeverity } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

/** Nomes das ações de audit_logs (AuditAction no backend). */
const ACTION_LABEL: Record<string, string> = {
  KYC_START_REVIEW: "KYC: análise iniciada",
  KYC_APPROVED: "KYC aprovado",
  KYC_REJECTED: "KYC recusado",
  KYC_INFO_REQUESTED: "KYC: pedida informação",
  KYC_DOCUMENTS_VIEWED: "Documentos KYC abertos",
  PAYMENT_CONFIRMED_MANUALLY: "Pagamento validado à mão",
  BALANCE_ADJUSTED: "Saldo ajustado",
  DEPOSIT_RELEASED: "Caução libertada",
  DEPOSIT_WITHHELD: "Caução retida",
  BOOKING_COMPLETED: "Reserva concluída",
  INCIDENT_RESOLVED: "Problema resolvido",
  ITEM_FEATURED: "Equipamento destacado",
  ITEM_UNFEATURED: "Destaque retirado",
  CONTRACT_VIEWED: "Contrato aberto por admin",
  RECEIPT_VIEWED: "Comprovativo aberto por admin",
  CONTRACT_ACCEPTED: "Contrato aceite",
  HANDOVER_REGISTERED: "Entrega/devolução registada",
  HANDOVER_CONFIRMED: "Entrega/devolução confirmada",
};

const ENTITY_LABEL: Record<string, string> = { BOOKING: "Reserva", KYC: "Verificação", ACCOUNT: "Conta", INCIDENT: "Problema", ITEM: "Equipamento" };

const SECURITY_LABEL: Record<string, string> = {
  LOGIN_LOCKED: "Login bloqueado (tentativas)",
  OTP_LOCKED: "Código bloqueado (5 erros)",
  RATE_LIMITED: "Limite de pedidos atingido",
  REFRESH_TOKEN_REUSE: "Sessão roubada? (refresh reutilizado)",
  ADMIN_LOGIN: "Admin entrou",
  ADMIN_MFA_FAILED: "Admin falhou o 2FA",
  PASSWORD_CHANGED: "Password alterada",
  PASSWORD_RESET: "Password recuperada",
  EMAIL_VERIFIED: "Email verificado",
  GOOGLE_LINKED: "Google associado",
  GOOGLE_EMAIL_IN_USE: "Google com email de outra conta",
};

const SEVERITY: Record<SecuritySeverity, { label: string; tone: Tone }> = {
  HIGH: { label: "Alta", tone: "erro" },
  MEDIUM: { label: "Média", tone: "pendente" },
  LOW: { label: "Baixa", tone: "neutro" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tab = "auditoria" | "seguranca";

function AuditoriaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "auditoria";

  return (
    <div className="grid max-w-6xl gap-6">
      <AdminHeader
        title="Auditoria e segurança"
        text="Quem fez o quê e quando. As ações sensíveis da equipa, as aceitações de contrato e as entregas ficam aqui para sempre (não se apagam)."
      />
      <Segmented
        label="Registo"
        value={tab}
        onChange={(t) => router.replace(`/admin/auditoria?tab=${t}`)}
        options={[
          { value: "auditoria", label: "Auditoria" },
          { value: "seguranca", label: "Segurança" },
        ]}
      />
      {tab === "auditoria" ? <AuditTab /> : <SecurityTab />}
    </div>
  );
}

export default function AdminAuditoria() {
  return (
    <Suspense>
      <AuditoriaInner />
    </Suspense>
  );
}

// ─── Auditoria ──────────────────────────────────────────────────────────────

function AuditTab() {
  const params = useSearchParams();
  const router = useRouter();
  const action = params.get("action") ?? "";
  const entityId = params.get("entityId") ?? "";
  const actorId = params.get("actorId") ?? "";
  const actorName = params.get("actorName") ?? "";
  const [idInput, setIdInput] = useState(entityId);

  // filtros na URL: dá para partilhar o link de um rasto com a equipa
  function setFilter(patch: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    q.set("tab", "auditoria");
    Object.entries(patch).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    router.replace(`/admin/auditoria?${q}`);
  }

  const idValid = !idInput || UUID.test(idInput.trim());
  const filters = { action: action || undefined, entityId: entityId || undefined, actorId: actorId || undefined };
  const key = `audit:${action}:${entityId}:${actorId}`;

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
        <SelectField
          label="Ação"
          value={action}
          onChange={(v) => setFilter({ action: v })}
          options={[{ value: "", label: "Todas" }, ...Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <TextField
          label="ID da reserva, verificação ou equipamento"
          value={idInput}
          onChange={setIdInput}
          error={idValid ? undefined : "Cola o identificador completo (UUID)."}
          placeholder="3f2a9c1e-…"
          onKeyDown={(e) => e.key === "Enter" && idValid && setFilter({ entityId: idInput.trim() })}
        />
        <Button variant="dark" disabled={!idValid} onClick={() => setFilter({ entityId: idInput.trim() })}>
          Filtrar
        </Button>
        {(actorId || entityId || action) && (
          <div className="flex flex-wrap gap-2 md:col-span-3">
            {actorId && <FilterChip label={`Autor: ${actorName || actorId.slice(0, 8)}`} onClear={() => setFilter({ actorId: "", actorName: "" })} />}
            {entityId && <FilterChip label={`Entidade: ${entityId.slice(0, 8)}…`} onClear={() => { setIdInput(""); setFilter({ entityId: "" }); }} />}
            {action && <FilterChip label={ACTION_LABEL[action] ?? action} onClear={() => setFilter({ action: "" })} />}
          </div>
        )}
      </Card>

      <Paged<AuditLog>
        key={key}
        cacheKey={key}
        load={(page) => adminApi.auditLogs({ ...filters, page })}
        empty={{ icon: ScrollText, title: "Sem registos", text: "Nada corresponde a estes filtros." }}
        columns={["Quando", "Quem", "Ação", "Sobre", "Motivo e detalhes"]}
        row={(a) => (
          <tr key={a.id} className="border-b border-borda align-top last:border-0">
            <td className="px-4 py-3 whitespace-nowrap text-[13px] text-cinza">{formatDateTime(a.createdAt)}</td>
            <td className="px-4 py-3">
              {a.actorId ? (
                <button type="button" className="text-left font-medium text-verde underline-offset-2 hover:underline" onClick={() => setFilter({ actorId: a.actorId!, actorName: a.actorName })}>
                  {a.actorName}
                </button>
              ) : (
                <span className="text-cinza">{a.actorName}</span>
              )}
            </td>
            <td className="px-4 py-3 font-medium text-verde">{ACTION_LABEL[a.action] ?? a.action}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => { setIdInput(a.entityId); setFilter({ entityId: a.entityId }); }}>
                <span className="text-[13px] text-cinza">{ENTITY_LABEL[a.entityType] ?? a.entityType}</span>{" "}
                <span className="num font-bold text-verde">{a.entityType === "BOOKING" ? bookingCode(a.entityId) : a.entityId.slice(0, 8)}</span>
              </button>
            </td>
            <td className="px-4 py-3 text-[13px]">
              {a.reason && <p className="text-texto-corpo">{a.reason}</p>}
              <Details data={a.metadata} />
            </td>
          </tr>
        )}
      />
    </div>
  );
}

// ─── Segurança ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [severity, setSeverity] = useState<SecuritySeverity | "">("");
  const key = `security:${severity}`;
  return (
    <div className="grid gap-4">
      <Card className="grid gap-4 p-4 md:max-w-xs">
        <SelectField
          label="Gravidade"
          value={severity}
          onChange={(v) => setSeverity(v as SecuritySeverity | "")}
          options={[{ value: "", label: "Todas" }, { value: "HIGH", label: "Alta" }, { value: "MEDIUM", label: "Média" }, { value: "LOW", label: "Baixa" }]}
        />
      </Card>
      <Paged<SecurityEvent>
        key={key}
        cacheKey={key}
        load={(page) => adminApi.securityEvents({ severity: severity || undefined, page })}
        empty={{ icon: ShieldAlert, title: "Sem eventos", text: "Nenhum evento de segurança com esta gravidade." }}
        columns={["Quando", "Evento", "Gravidade", "Perfil", "Origem", "Detalhes"]}
        row={(e) => (
          <tr key={e.id} className="border-b border-borda align-top last:border-0">
            <td className="px-4 py-3 whitespace-nowrap text-[13px] text-cinza">{formatDateTime(e.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-verde">{SECURITY_LABEL[e.type] ?? e.type}</td>
            <td className="px-4 py-3"><Badge tone={SEVERITY[e.severity]?.tone ?? "neutro"}>{SEVERITY[e.severity]?.label ?? e.severity}</Badge></td>
            <td className="num px-4 py-3 text-[13px]">{e.profileId ? e.profileId.slice(0, 8) : "—"}</td>
            <td className="px-4 py-3 text-[13px] text-cinza">
              {e.ip && <p className="num">{e.ip}</p>}
              {e.requestId && <p className="num" title="X-Request-Id: procura este valor nos logs do Render">req {e.requestId.slice(0, 12)}</p>}
            </td>
            <td className="px-4 py-3 text-[13px]"><Details data={e.details} /></td>
          </tr>
        )}
      />
    </div>
  );
}

// ─── Peças ──────────────────────────────────────────────────────────────────

/** Tabela paginada ("Carregar mais"), com a carregar / vazio / erro. */
function Paged<T>({
  cacheKey, load, columns, row, empty,
}: {
  cacheKey: string;
  load: (page: number) => Promise<Page<T>>;
  columns: string[];
  row: (t: T) => React.ReactNode;
  empty: { icon: typeof ScrollText; title: string; text: string };
}) {
  const first = useResource<Page<T>>(cacheKey, () => load(0));
  const [more, setMore] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  if (first.error) return <Card><ErrorState message={first.error} onRetry={first.reload} /></Card>;
  if (!first.data) return <Card className="p-4"><ListSkeleton rows={5} /></Card>;

  const rows = [...first.data.content, ...more];
  const totalPages = first.data.page?.totalPages ?? first.data.totalPages ?? 1;
  if (rows.length === 0) return <Card><EmptyState icon={empty.icon} title={empty.title} text={empty.text} /></Card>;

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await load(page + 1);
      setMore((m) => [...m, ...next.content]);
      setPage((p) => p + 1);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "Falhou.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[15px]">
          <thead className="bg-areia">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="border-b border-borda px-4 py-3 text-xs font-bold tracking-[0.1em] text-cinza uppercase">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map(row)}</tbody>
        </table>
      </div>
      {page + 1 < totalPages && (
        <div className="grid justify-items-center gap-2 border-t border-borda p-4">
          {moreError && <p role="alert" className="text-sm text-erro">{moreError}</p>}
          <Button variant="outline" loading={loadingMore} onClick={loadMore}>
            {moreError ? "Tentar outra vez" : "Carregar mais"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Metadados como "chave: valor" (sem dados pessoais: o backend nunca os põe aqui). */
function Details({ data }: { data: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(data ?? {});
  if (!entries.length) return null;
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px] text-cinza">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd className="num break-all text-texto-corpo">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-full bg-salvia-tint pr-1 pl-3 text-sm font-medium text-verde">
      {label}
      <button type="button" onClick={onClear} aria-label={`Tirar filtro ${label}`} className="flex size-8 items-center justify-center rounded-full hover:bg-white/60">
        <X className="size-4" strokeWidth={2} />
      </button>
    </span>
  );
}
