"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Ban, CalendarDays, Mail, MapPin, Package, Phone, RotateCcw, ScrollText, ShieldCheck, ShieldMinus } from "lucide-react";
import { AdminHeader, BookingStatusBadge, ConfirmWithReason } from "@/components/bz/admin";
import { ITEM_STATUS, KycBadge, RoleLabel } from "@/components/bz/admin-users";
import { RoleChangeSheet, type RoleTarget } from "@/components/bz/admin-role";
import { toast } from "@/components/bz/overlay";
import { ErrorState } from "@/components/bz/states";
import { BackLink, Badge, Button, ButtonLink, Card, InfoRow, Kz, Skeleton } from "@/components/bz/ui";
import { adminApi } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { formatDateTime, formatRange } from "@/lib/format";
import type { AdminUserDetail } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

type ItemAction = { id: string; title: string; suspend: boolean } | null;

/** Ficha de um utilizador para a equipa: dados, equipamento, reservas, suspender/reativar (com motivo e auditoria). */
export default function UtilizadorPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useResource<AdminUserDetail>(`admin:user:${id}`, () => adminApi.user(id));
  const [accountAction, setAccountAction] = useState<"suspend" | "reinstate" | null>(null);
  const [itemAction, setItemAction] = useState<ItemAction>(null);
  const [roleTarget, setRoleTarget] = useState<RoleTarget | null>(null);
  const me = useSession()?.profileId;

  if (detail.error) {
    const notFound = detail.error.includes("não encontrad");
    return <ErrorState message={notFound ? "Este utilizador não existe." : detail.error} onRetry={notFound ? undefined : detail.reload} />;
  }
  if (!detail.data) return <Skeleton role="status" aria-label="A carregar" className="h-96 max-w-5xl rounded-sheet" />;

  const { user: u, items, recentBookings, city } = detail.data;
  const isTeam = u.role === "ADMIN";

  return (
    <div className="grid max-w-5xl gap-6">
      <BackLink href="/admin/utilizadores">Utilizadores</BackLink>
      <AdminHeader
        title={u.fullName}
        text={`Registo a ${formatDateTime(u.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {u.id !== me && (isTeam || !u.suspendedAt) && (
              <Button
                variant="outline"
                size="sm"
                className={isTeam ? "text-erro" : undefined}
                onClick={() => setRoleTarget({ id: u.id, fullName: u.fullName, makeAdmin: !isTeam })}
              >
                {isTeam ? <ShieldMinus strokeWidth={1.8} /> : <ShieldCheck strokeWidth={1.8} />} {isTeam ? "Retirar admin" : "Tornar admin"}
              </Button>
            )}
            {isTeam ? null : u.suspendedAt ? (
              <Button variant="outline" size="sm" onClick={() => setAccountAction("reinstate")}>
                <RotateCcw strokeWidth={1.8} /> Reativar conta
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-erro" onClick={() => setAccountAction("suspend")}>
                <Ban strokeWidth={1.8} /> Suspender conta
              </Button>
            )}
          </div>
        }
      />

      {u.suspendedAt && (
        <Card className="grid gap-1 border-erro p-5" role="status">
          <p className="font-bold text-erro">Conta suspensa a {formatDateTime(u.suspendedAt)}</p>
          {u.suspensionReason && <p className="text-[15px]">Motivo: {u.suspensionReason}</p>}
          <p className="text-sm text-cinza">Não consegue entrar e o equipamento não aparece no Explorar. As reservas em curso continuam.</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <KycBadge status={u.kycStatus} />
            {!u.phoneVerified && <Badge tone="pendente">Telefone por confirmar</Badge>}
            <span className="text-sm text-cinza">
              <RoleLabel role={u.role} />
            </span>
          </div>
          <InfoRow icon={Phone} label="Telefone">
            <a href={`tel:${u.phone}`} className="font-medium text-verde hover:underline">{u.phone}</a>
          </InfoRow>
          {u.email && (
            <InfoRow icon={Mail} label="Email">
              <a href={`mailto:${u.email}`} className="break-all font-medium text-verde hover:underline">{u.email}</a>
            </InfoRow>
          )}
          {city && <InfoRow icon={MapPin} label="Cidade">{city}</InfoRow>}
          <InfoRow icon={CalendarDays} label="Reservas">
            {u.bookingsAsRenter} como arrendatário · {u.bookingsAsOwner} como dono
          </InfoRow>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href={`/admin/auditoria?actorId=${u.id}&actorName=${encodeURIComponent(u.fullName)}`} variant="outline" size="sm">
              <ScrollText strokeWidth={1.8} /> O que fez
            </ButtonLink>
            <ButtonLink href={`/admin/auditoria?entityId=${u.id}`} variant="outline" size="sm">
              <ScrollText strokeWidth={1.8} /> Decisões sobre a conta
            </ButtonLink>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="grid gap-3 p-5">
            <h2 className="font-titulo text-lg font-bold text-verde">Equipamento ({items.length})</h2>
            {items.length === 0 ? (
              <p className="text-sm text-cinza">Não publicou equipamento.</p>
            ) : (
              <ul className="grid">
                {items.map((it) => {
                  const st = ITEM_STATUS[it.status];
                  return (
                    <li key={it.id} className="flex flex-wrap items-center gap-3 border-b border-borda py-3 last:border-0">
                      <Package className="size-5 shrink-0 text-mel" strokeWidth={1.8} aria-hidden />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <Link href={`/equipamento/${it.id}`} className="truncate font-bold text-verde hover:underline">{it.title}</Link>
                        <span className="flex flex-wrap items-center gap-2 text-[13px] text-cinza">
                          <Kz value={it.pricePerDay} />/dia
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {it.featured && <Badge tone="escuro">Destaque</Badge>}
                        </span>
                      </span>
                      {it.status === "SUSPENDED" ? (
                        <Button variant="outline" size="sm" onClick={() => setItemAction({ id: it.id, title: it.title, suspend: false })}>Reativar</Button>
                      ) : (
                        <Button variant="outline" size="sm" className="text-erro" onClick={() => setItemAction({ id: it.id, title: it.title, suspend: true })}>Suspender</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="grid gap-3 p-5">
            <h2 className="font-titulo text-lg font-bold text-verde">Reservas recentes</h2>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-cinza">Ainda sem reservas.</p>
            ) : (
              <ul className="grid">
                {recentBookings.map((b) => (
                  <li key={b.id} className="border-b border-borda last:border-0">
                    <Link href={`/admin/reservas/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:underline">
                      <span className="min-w-0 flex-1 truncate font-medium text-verde">{b.itemTitle}</span>
                      <span className="text-[13px] text-cinza">
                        {b.side === "RENTER" ? "arrendatário" : "dono"} · {formatRange(b.startDate, b.endDate)}
                      </span>
                      <BookingStatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <RoleChangeSheet target={roleTarget} onClose={() => setRoleTarget(null)} onDone={detail.reload} />

      <ConfirmWithReason
        open={accountAction === "suspend"}
        onClose={() => setAccountAction(null)}
        danger
        title={`Suspender a conta de ${u.fullName}?`}
        confirmLabel="Suspender conta"
        placeholder="Ex.: equipamento anunciado não existe; dono não devolveu a caução e não responde."
        onConfirm={async (reason) => {
          await adminApi.suspendUser(u.id, reason);
          detail.reload();
          toast.success("Conta suspensa. Avisa a pessoa pelo telefone ou email.");
        }}
      >
        <p>
          Sai de todas as sessões (no máximo em 15 minutos) e não volta a entrar. O equipamento sai do Explorar. As reservas em curso não
          mudam: decide-as caso a caso. A pessoa não é avisada automaticamente.
        </p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={accountAction === "reinstate"}
        onClose={() => setAccountAction(null)}
        title={`Reativar a conta de ${u.fullName}?`}
        confirmLabel="Reativar conta"
        minReason={0}
        reasonLabel="Motivo (opcional)"
        placeholder="Ex.: situação resolvida com a equipa."
        onConfirm={async (reason) => {
          await adminApi.reinstateUser(u.id, reason || undefined);
          detail.reload();
          toast.success("Conta reativada.");
        }}
      >
        <p>Volta a poder entrar e o equipamento volta ao Explorar como estava.</p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={itemAction !== null}
        onClose={() => setItemAction(null)}
        danger={itemAction?.suspend}
        title={itemAction?.suspend ? `Suspender "${itemAction.title}"?` : `Reativar "${itemAction?.title ?? ""}"?`}
        confirmLabel={itemAction?.suspend ? "Suspender equipamento" : "Reativar equipamento"}
        minReason={itemAction?.suspend ? 5 : 0}
        reasonLabel={itemAction?.suspend ? "Motivo (obrigatório)" : "Motivo (opcional)"}
        placeholder={itemAction?.suspend ? "Ex.: as fotos não correspondem ao equipamento." : "Ex.: o dono corrigiu as fotos."}
        onConfirm={async (reason) => {
          if (!itemAction) return;
          if (itemAction.suspend) await adminApi.suspendItem(itemAction.id, reason);
          else await adminApi.reinstateItem(itemAction.id, reason || undefined);
          detail.reload();
          toast.success(itemAction.suspend ? "Equipamento suspenso." : "Equipamento reativado.");
        }}
      >
        <p>
          {itemAction?.suspend
            ? "Sai do Explorar, perde o destaque e deixa de aceitar pedidos. O dono não o consegue reativar. As reservas já feitas continuam."
            : "Volta ao Explorar e a aceitar pedidos."}
        </p>
      </ConfirmWithReason>
    </div>
  );
}
