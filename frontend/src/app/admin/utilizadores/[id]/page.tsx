"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ban, ExternalLink, LogOut, MessageSquareText, PhoneOff, RotateCcw, StickyNote, type LucideIcon,
} from "lucide-react";
import { AdminHeader, AdminPanel, BookingStatusBadge, ConfirmWithReason } from "@/components/bz/admin";
import { AuditTimeline } from "@/components/bz/admin-history";
import { Can, useAdminAccess } from "@/components/bz/admin-shell";
import { AdminTabs, DataTable, Pagination, TableSkeleton, Td, Th, Tr, pageTotal } from "@/components/bz/admin-table";
import { ITEM_STATUS, KycBadge, RoleLabel } from "@/components/bz/admin-users";
import { TextArea } from "@/components/bz/form";
import { toast } from "@/components/bz/overlay";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { BackLink, Badge, Button, ButtonLink, Kz, Skeleton } from "@/components/bz/ui";
import { ApiError, adminApi } from "@/lib/api";
import { ADMIN_CONFLICT, ADMIN_ROLE_LABEL, adminUsersApi, type AdminUserNote } from "@/lib/api-admin";
import { useSession } from "@/lib/auth";
import { formatDateTime, formatRange } from "@/lib/format";
import type { AdminUserDetail, AuditLog, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { cn } from "@/lib/utils";

type Tab = "equipamento" | "reservas" | "notas" | "historico";
type AccountAction = "suspend" | "reinstate" | "sessions" | "phone";
type ItemAction = { id: string; title: string; suspend: boolean } | null;

function errorText(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.code && ADMIN_CONFLICT[e.code]) return ADMIN_CONFLICT[e.code];
  return e instanceof Error ? e.message : fallback;
}

/** Ficha de uma conta (decisoes-produto.md 2026-11-18): perfil, KYC, equipamento, reservas, notas, histórico, ações. */
export default function UtilizadorPage() {
  return (
    <Suspense>
      <Utilizador />
    </Suspense>
  );
}

function Utilizador() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = raw === "reservas" || raw === "notas" || raw === "historico" ? raw : "equipamento";
  const detail = useResource<AdminUserDetail>(`admin:user:${id}`, () => adminUsersApi.detail(id));
  const [action, setAction] = useState<AccountAction | null>(null);
  const [itemAction, setItemAction] = useState<ItemAction>(null);
  const me = useSession()?.profileId;
  const { can } = useAdminAccess();

  if (detail.error) {
    const notFound = /não encontrad/i.test(detail.error);
    return (
      <div className="grid gap-4">
        <BackLink href="/admin/utilizadores">Utilizadores</BackLink>
        <ErrorState message={notFound ? "Esta conta não existe." : detail.error} onRetry={notFound ? undefined : detail.reload} />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div role="status" aria-label="A carregar a conta" className="grid gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 rounded-cartao" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-80 rounded-cartao" />
          <Skeleton className="h-80 rounded-cartao" />
        </div>
      </div>
    );
  }

  const d = detail.data;
  const u = d.user;
  const isTeam = u.role === "ADMIN";
  const isMe = u.id === me;
  const canManage = can("USERS_MANAGE") && !isMe;
  const reload = detail.reload;

  return (
    <div className="grid gap-4">
      <BackLink href="/admin/utilizadores">Utilizadores</BackLink>
      <AdminHeader
        title={u.fullName}
        meta={
          <>
            {u.suspendedAt ? <Badge tone="erro">Suspensa</Badge> : <Badge tone="ok">Ativa</Badge>}
            {isTeam && <Badge tone="escuro">{u.adminRole ? ADMIN_ROLE_LABEL[u.adminRole] : "Equipa"}</Badge>}
            <KycBadge status={u.kycStatus} />
            {!u.phoneVerified && <Badge tone="pendente">Telefone por confirmar</Badge>}
            <span className="text-sm text-cinza">Registo a {formatDateTime(u.createdAt)}</span>
          </>
        }
        action={
          <>
            <Can perm="MESSAGES">
              <ButtonLink
                href={`/admin/mensagens?para=${u.id}&nome=${encodeURIComponent(u.fullName)}`}
                variant="outline"
                size="sm"
              >
                <MessageSquareText strokeWidth={1.8} /> Enviar mensagem
              </ButtonLink>
            </Can>
            <Can perm="USERS_NOTE">
              <ButtonLink href={`${pathname}?tab=notas`} variant="outline" size="sm" scroll={false}>
                <StickyNote strokeWidth={1.8} /> Nota interna
              </ButtonLink>
            </Can>
          </>
        }
      />

      {u.suspendedAt && (
        <div role="status" className="grid gap-1 rounded-cartao border border-erro bg-erro-tint p-4 text-sm text-erro">
          <p className="font-bold">
            Suspensa a {formatDateTime(u.suspendedAt)}
            {d.suspendedByName ? ` por ${d.suspendedByName}` : ""}
          </p>
          {u.suspensionReason && <p>Motivo: {u.suspensionReason}</p>}
          <p>Não entra e o equipamento não aparece no Explorar. As reservas em curso continuam.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <AdminPanel>
          <div className="px-2">
            <AdminTabs<Tab>
              label="Secções da conta"
              idBase="conta"
              value={tab}
              onChange={(v) => router.replace(`${pathname}${v === "equipamento" ? "" : `?tab=${v}`}`, { scroll: false })}
              options={[
                { value: "equipamento", label: "Equipamento", count: d.items.length },
                { value: "reservas", label: "Reservas", count: u.bookingsAsOwner + u.bookingsAsRenter },
                { value: "notas", label: "Notas", count: d.notes },
                { value: "historico", label: "Histórico" },
              ]}
            />
          </div>
          <div id="conta-panel" role="tabpanel" aria-labelledby={`conta-tab-${tab}`}>
            {tab === "equipamento" && (
              <ItemsTab detail={d} canModerate={can("ITEMS_MODERATE")} onAction={setItemAction} />
            )}
            {tab === "reservas" && <BookingsTab detail={d} canOpen={can("OPERATIONS_DESK")} />}
            {tab === "notas" && <NotesTab userId={u.id} canWrite={can("USERS_NOTE")} onAdded={reload} />}
            {tab === "historico" && <HistoryTab userId={u.id} />}
          </div>
        </AdminPanel>

        <div className="grid gap-4">
          <AdminPanel title="Perfil">
            <dl className="grid text-sm">
              <Row label="Telefone">
                <a href={`tel:${u.phone}`} className="num font-medium text-verde hover:underline">{u.phone}</a>
                <span className="ml-2 text-xs text-cinza">{u.phoneVerified ? "confirmado" : "por confirmar"}</span>
              </Row>
              <Row label="Email">
                {u.email ? (
                  <>
                    <a href={`mailto:${u.email}`} className="break-all font-medium text-verde hover:underline">{u.email}</a>
                    <span className="ml-2 text-xs text-cinza">{d.emailVerified ? "confirmado" : "por confirmar"}</span>
                  </>
                ) : "—"}
              </Row>
              <Row label="Papel">{isTeam ? "Equipa" : <span className="capitalize"><RoleLabel role={u.role} /></span>}</Row>
              <Row label="Local">{[d.city, d.province].filter(Boolean).join(", ") || "—"}</Row>
              <Row label="Reservas">{u.bookingsAsRenter} como arrendatário · {u.bookingsAsOwner} como dono</Row>
              <Row label="Sessões ativas">
                <span className="num">{d.activeSessions}</span>
                {d.lastSessionAt && <span className="block text-xs text-cinza">Última entrada {formatDateTime(d.lastSessionAt)}</span>}
              </Row>
            </dl>
          </AdminPanel>

          <AdminPanel
            title="Verificação de identidade"
            action={
              (d.kyc || u.kycStatus) && can("KYC") ? (
                <Link href={`/admin/verificacoes?pessoa=${u.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-mel-texto hover:underline">
                  Ver documentos <ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden />
                </Link>
              ) : undefined
            }
          >
            <div className="grid gap-1 px-4 py-3 text-sm">
              {d.kyc ? (
                <>
                  <p><KycBadge status={d.kyc.status} /></p>
                  <p className="text-cinza">
                    {d.kyc.accountType === "BUSINESS" ? "Empresa" : "Particular"} · submetido a {formatDateTime(d.kyc.submittedAt)}
                  </p>
                  {d.kyc.reviewedAt && <p className="text-cinza">Decidido a {formatDateTime(d.kyc.reviewedAt)}</p>}
                  <p className="text-xs text-cinza">Os documentos só se abrem em Verificações (link de 5 minutos, fica na auditoria).</p>
                </>
              ) : (
                <p className="text-cinza">Nunca submeteu a verificação.</p>
              )}
            </div>
          </AdminPanel>

          <AdminPanel title="Ações sobre a conta">
            {isMe ? (
              <p className="px-4 py-3 text-sm text-cinza">É a tua conta. Muda-a em A minha conta.</p>
            ) : isTeam ? (
              <p className="px-4 py-3 text-sm text-cinza">
                Conta da equipa: o acesso gere-se em{" "}
                {can("TEAM") ? <Link href="/admin/equipa" className="font-medium text-mel-texto hover:underline">Equipa e acessos</Link> : "Equipa e acessos (super admin)"}.
              </p>
            ) : !canManage ? (
              <p className="px-4 py-3 text-sm text-cinza">O teu papel não inclui ações sobre contas. Escreve uma nota para a equipa de Confiança.</p>
            ) : (
              <ul className="grid">
                <ActionRow icon={LogOut} title="Terminar sessões" text={`Sai de todos os dispositivos (${d.activeSessions} ${d.activeSessions === 1 ? "sessão ativa" : "sessões ativas"}).`} onClick={() => setAction("sessions")} />
                {u.phoneVerified && (
                  <ActionRow icon={PhoneOff} title="Repor confirmação do telefone" text="Volta a confirmar o número com um código no próximo login." onClick={() => setAction("phone")} />
                )}
                {u.suspendedAt ? (
                  <ActionRow icon={RotateCcw} title="Reativar conta" text="Volta a entrar; o equipamento volta ao Explorar." onClick={() => setAction("reinstate")} />
                ) : (
                  <ActionRow icon={Ban} danger title="Suspender conta" text="Não entra e o equipamento sai do Explorar." onClick={() => setAction("suspend")} />
                )}
              </ul>
            )}
          </AdminPanel>
        </div>
      </div>

      <ConfirmWithReason
        open={action === "suspend"}
        onClose={() => setAction(null)}
        danger
        title={`Suspender a conta de ${u.fullName}?`}
        confirmLabel="Suspender conta"
        placeholder="Ex.: equipamento anunciado não existe; dono não devolveu a caução e não responde."
        onConfirm={async (reason) => {
          try {
            await adminUsersApi.suspend(u.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível suspender."));
          }
          reload();
          toast.success("Conta suspensa. Avisa a pessoa por telefone ou mensagem.");
        }}
      >
        <p className="text-[15px]">
          Sai de todas as sessões (no máximo em 15 minutos) e não volta a entrar. O equipamento sai do Explorar. As reservas em curso não
          mudam: decide-as caso a caso. A pessoa não é avisada automaticamente.
        </p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={action === "reinstate"}
        onClose={() => setAction(null)}
        title={`Reativar a conta de ${u.fullName}?`}
        confirmLabel="Reativar conta"
        placeholder="Ex.: situação resolvida com a equipa."
        onConfirm={async (reason) => {
          try {
            await adminUsersApi.reinstate(u.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível reativar."));
          }
          reload();
          toast.success("Conta reativada.");
        }}
      >
        <p className="text-[15px]">Volta a poder entrar e o equipamento volta ao Explorar como estava.</p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={action === "sessions"}
        onClose={() => setAction(null)}
        title={`Terminar as sessões de ${u.fullName}?`}
        confirmLabel="Terminar sessões"
        placeholder="Ex.: a pessoa diz que perdeu o telemóvel."
        onConfirm={async (reason) => {
          try {
            await adminUsersApi.revokeSessions(u.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível terminar as sessões."));
          }
          reload();
          toast.success("Sessões terminadas.");
        }}
      >
        <p className="text-[15px]">
          A pessoa sai de todos os dispositivos (no máximo em 15 minutos) e tem de entrar outra vez com a password. A conta continua ativa.
        </p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={action === "phone"}
        onClose={() => setAction(null)}
        danger
        title="Repor a confirmação do telefone?"
        confirmLabel="Repor confirmação"
        placeholder="Ex.: o número foi reatribuído pela operadora."
        onConfirm={async (reason) => {
          try {
            await adminUsersApi.resetPhone(u.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível repor a confirmação."));
          }
          reload();
          toast.success("Feito. No próximo login a pessoa recebe um código para confirmar o número.");
        }}
      >
        <p className="text-[15px]">
          {u.phone} passa a &quot;por confirmar&quot; e as sessões terminam. No próximo login a pessoa recebe um código por WhatsApp ou SMS
          e só entra depois de o confirmar.
        </p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={itemAction !== null}
        onClose={() => setItemAction(null)}
        danger={itemAction?.suspend}
        title={itemAction?.suspend ? `Suspender "${itemAction.title}"?` : `Reativar "${itemAction?.title ?? ""}"?`}
        confirmLabel={itemAction?.suspend ? "Suspender equipamento" : "Reativar equipamento"}
        placeholder={itemAction?.suspend ? "Ex.: as fotos não correspondem ao equipamento." : "Ex.: o dono corrigiu as fotos."}
        onConfirm={async (reason) => {
          if (!itemAction) return;
          if (itemAction.suspend) await adminApi.suspendItem(itemAction.id, reason);
          else await adminApi.reinstateItem(itemAction.id, reason);
          reload();
          toast.success(itemAction.suspend ? "Equipamento suspenso." : "Equipamento reativado.");
        }}
      >
        <p className="text-[15px]">
          {itemAction?.suspend
            ? "Sai do Explorar, perde o destaque e deixa de aceitar pedidos. O dono não o consegue reativar. As reservas já feitas continuam."
            : "Volta ao Explorar e a aceitar pedidos."}
        </p>
      </ConfirmWithReason>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-borda px-4 py-2.5 last:border-0">
      <dt className="text-cinza">{label}</dt>
      <dd className="min-w-0 text-texto-corpo">{children}</dd>
    </div>
  );
}

function ActionRow({ icon: Icon, title, text, onClick, danger }: { icon: LucideIcon; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <li className="border-b border-borda last:border-0">
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-areia">
        <Icon className={cn("mt-0.5 size-[18px] shrink-0", danger ? "text-erro" : "text-cinza")} strokeWidth={1.8} aria-hidden />
        <span className="grid gap-0.5">
          <span className={cn("text-sm font-bold", danger ? "text-erro" : "text-verde")}>{title}</span>
          <span className="text-[13px] text-cinza">{text}</span>
        </span>
      </button>
    </li>
  );
}

function ItemsTab({ detail, canModerate, onAction }: { detail: AdminUserDetail; canModerate: boolean; onAction: (a: ItemAction) => void }) {
  if (detail.items.length === 0) return <p className="px-4 py-6 text-sm text-cinza">Não publicou equipamento.</p>;
  return (
    <DataTable label="Equipamento" minWidth={560}>
      <thead>
        <tr>
          <Th>Equipamento</Th>
          <Th>Estado</Th>
          <Th align="right">Preço/dia</Th>
          {canModerate && <Th align="right"><span className="sr-only">Ações</span></Th>}
        </tr>
      </thead>
      <tbody>
        {detail.items.map((it) => {
          const st = ITEM_STATUS[it.status];
          return (
            <Tr key={it.id}>
              <Td>
                <Link href={`/equipamento/${it.id}`} className="font-bold text-verde hover:underline">{it.title}</Link>
                {it.featured && <Badge tone="escuro" className="ml-2">Destaque</Badge>}
              </Td>
              <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
              <Td align="right"><Kz value={it.pricePerDay} /></Td>
              {canModerate && (
                <Td align="right">
                  {it.status === "SUSPENDED" ? (
                    <Button variant="ghost" size="sm" onClick={() => onAction({ id: it.id, title: it.title, suspend: false })}>Reativar</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-erro" onClick={() => onAction({ id: it.id, title: it.title, suspend: true })}>Suspender</Button>
                  )}
                </Td>
              )}
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function BookingsTab({ detail, canOpen }: { detail: AdminUserDetail; canOpen: boolean }) {
  if (detail.recentBookings.length === 0) return <p className="px-4 py-6 text-sm text-cinza">Ainda sem reservas.</p>;
  return (
    <>
      <DataTable label="Reservas recentes" minWidth={560}>
        <thead>
          <tr>
            <Th>Equipamento</Th>
            <Th>Como</Th>
            <Th>Datas</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {detail.recentBookings.map((b) => (
            <Tr key={b.id}>
              <Td>
                {canOpen ? (
                  <Link href={`/admin/reservas/${b.id}`} className="font-bold text-verde hover:underline">{b.itemTitle}</Link>
                ) : (
                  <span className="font-bold text-verde">{b.itemTitle}</span>
                )}
              </Td>
              <Td className="text-cinza">{b.side === "RENTER" ? "Arrendatário" : "Dono"}</Td>
              <Td className="whitespace-nowrap">{formatRange(b.startDate, b.endDate)}</Td>
              <Td><BookingStatusBadge status={b.status} /></Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
      <p className="border-t border-borda px-4 py-2.5 text-[13px] text-cinza">As 10 mais recentes.</p>
    </>
  );
}

function NotesTab({ userId, canWrite, onAdded }: { userId: string; canWrite: boolean; onAdded: () => void }) {
  const notes = useResource<AdminUserNote[]>(`admin:user-notes:${userId}`, () => adminUsersApi.notes(userId));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (!body.trim()) return setError("Escreve a nota.");
    setBusy(true);
    setError(undefined);
    try {
      await adminUsersApi.addNote(userId, body.trim());
      setBody("");
      notes.reload();
      onAdded();
      toast.success("Nota guardada.");
    } catch (e) {
      setError(errorText(e, "Não foi possível guardar a nota."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      {canWrite && (
        <div className="grid gap-2 border-b border-borda p-4">
          <TextArea
            label="Nova nota interna"
            hint="Só a equipa vê. Não se edita nem apaga: para corrigir, escreve outra. Não escrevas números de BI, NIF ou referências de pagamento."
            value={body}
            onChange={setBody}
            rows={3}
            maxLength={2000}
            error={error}
          />
          <div>
            <Button variant="dark" size="sm" loading={busy} onClick={save}>Guardar nota</Button>
          </div>
        </div>
      )}
      {notes.error ? (
        <ErrorState message={notes.error} onRetry={notes.reload} className="py-8" />
      ) : !notes.data ? (
        <TableSkeleton rows={3} label="A carregar notas" />
      ) : notes.data.length === 0 ? (
        <EmptyState icon={StickyNote} title="Sem notas" text="Regista aqui contactos, combinações e contexto para o resto da equipa." className="py-8" />
      ) : (
        <ol className="grid">
          {notes.data.map((n) => (
            <li key={n.id} className="grid gap-1 border-b border-borda px-4 py-3 last:border-0">
              <p className="text-[13px] text-cinza">
                <span className="font-bold text-verde">{n.authorName}</span> · {formatDateTime(n.createdAt)}
              </p>
              <p className="text-[15px] whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function HistoryTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(0);
  const history = useResource<Page<AuditLog>>(`admin:user-history:${userId}:${page}`, () => adminUsersApi.history(userId, page));
  if (history.error) return <ErrorState message={history.error} onRetry={history.reload} className="py-8" />;
  if (!history.data) return <TableSkeleton rows={4} label="A carregar histórico" />;
  const total = pageTotal(history.data);
  return (
    <>
      <AuditTimeline entries={history.data.content} emptyText="Nenhuma decisão sobre esta conta, a verificação ou o equipamento." />
      {total > 20 && <Pagination page={page} size={20} total={total} onPage={setPage} />}
    </>
  );
}
