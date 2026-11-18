"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, MailCheck, UserPlus, Users } from "lucide-react";
import { AdminHeader, AdminPanel, ConfirmWithReason } from "@/components/bz/admin";
import { DataTable, FilterSelect, Pagination, SearchInput, TableSkeleton, Td, Th, Tr, pageTotal } from "@/components/bz/admin-table";
import { FormError, RadioCards, TextArea, TextField } from "@/components/bz/form";
import { Sheet, copyText, toast } from "@/components/bz/overlay";
import { Segmented } from "@/components/bz/tabs";
import { EmptyState, ErrorState } from "@/components/bz/states";
import { Badge, Button, type Tone } from "@/components/bz/ui";
import { ApiError } from "@/lib/api";
import {
  ADMIN_CONFLICT, ADMIN_ROLE_LABEL, ADMIN_ROLE_SCOPE, adminTeamApi, adminUsersApi,
  type InvitationStatus, type TeamInvitation, type TeamMember,
} from "@/lib/api-admin";
import { useSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { AdminRole, AdminUserSummary, Page } from "@/lib/types";
import { useResource } from "@/lib/use-resource";

const ROLES = Object.keys(ADMIN_ROLE_LABEL) as AdminRole[];

const INVITE_STATUS: Record<InvitationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendente", tone: "pendente" },
  ACCEPTED: { label: "Aceite", tone: "ok" },
  REVOKED: { label: "Cancelado", tone: "neutro" },
  EXPIRED: { label: "Expirado", tone: "neutro" },
};

function errorText(e: unknown, fallback: string) {
  if (e instanceof ApiError && e.code && ADMIN_CONFLICT[e.code]) return ADMIN_CONFLICT[e.code];
  return e instanceof Error ? e.message : fallback;
}

/**
 * Admin › Sistema › Equipa e acessos (decisoes-produto.md 2026-11-18). Só SUPER_ADMIN.
 * O acesso entra só por convite (link de uso único, 72 h); mudar papel e retirar acesso pedem motivo.
 */
export default function EquipaPage() {
  const me = useSession()?.profileId;
  const members = useResource<TeamMember[]>("admin:team", adminTeamApi.members);
  const [invPage, setInvPage] = useState(0);
  const invitations = useResource<Page<TeamInvitation>>(`admin:team-invites:${invPage}`, () => adminTeamApi.invitations(invPage));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ member: TeamMember; role: AdminRole } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamMember | null>(null);
  const [cancelInvite, setCancelInvite] = useState<TeamInvitation | null>(null);

  const reloadAll = () => {
    members.reload();
    invitations.reload();
  };

  return (
    <div className="grid gap-4">
      <AdminHeader
        title="Equipa e acessos"
        text="Quem entra no Admin e com que papel. O acesso só se dá por convite; cada mudança fica na auditoria."
        action={
          <Button variant="dark" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus strokeWidth={1.8} /> Convidar pessoa
          </Button>
        }
      />

      <AdminPanel title="Membros da equipa">
        {members.error ? (
          <ErrorState message={members.error} onRetry={members.reload} className="py-8" />
        ) : !members.data ? (
          <TableSkeleton rows={3} label="A carregar a equipa" />
        ) : members.data.length === 0 ? (
          <EmptyState icon={Users} title="Sem membros" className="py-8" />
        ) : (
          <DataTable label="Membros da equipa" minWidth={760}>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Contacto</Th>
                <Th>Papel</Th>
                <Th>Último login de admin</Th>
                <Th align="right"><span className="sr-only">Ações</span></Th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((m) => {
                const isMe = m.id === me;
                return (
                  <Tr key={m.id}>
                    <Td>
                      <Link href={`/admin/utilizadores/${m.id}`} className="font-bold text-verde hover:underline">{m.fullName}</Link>
                      {isMe && <span className="ml-2 text-xs text-cinza">(tu)</span>}
                    </Td>
                    <Td className="text-cinza">
                      <span className="num block text-texto-corpo">{m.phone}</span>
                      {m.email && <span className="block text-xs">{m.email}</span>}
                    </Td>
                    <Td>
                      {isMe ? (
                        <Badge tone="escuro">{m.adminRole ? ADMIN_ROLE_LABEL[m.adminRole] : "Sem papel"}</Badge>
                      ) : (
                        <FilterSelect<AdminRole>
                          label={`Papel de ${m.fullName}`}
                          value={m.adminRole ?? ""}
                          allLabel="Sem papel"
                          options={ROLES.map((r) => ({ value: r, label: ADMIN_ROLE_LABEL[r] }))}
                          onChange={(v) => v && v !== m.adminRole && setRoleTarget({ member: m, role: v })}
                        />
                      )}
                    </Td>
                    <Td className="text-cinza">{m.lastAdminLoginAt ? formatDateTime(m.lastAdminLoginAt) : "—"}</Td>
                    <Td align="right">
                      {!isMe && (
                        <Button variant="ghost" size="sm" className="text-erro" onClick={() => setRevokeTarget(m)}>
                          Retirar acesso
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </AdminPanel>

      <AdminPanel title="Papéis">
        <dl className="grid gap-px bg-borda sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="grid gap-0.5 bg-branco px-4 py-3">
              <dt className="text-sm font-bold text-verde">{ADMIN_ROLE_LABEL[r]}</dt>
              <dd className="text-[13px] text-cinza">{ADMIN_ROLE_SCOPE[r]}</dd>
            </div>
          ))}
        </dl>
      </AdminPanel>

      <AdminPanel title="Convites">
        {invitations.error ? (
          <ErrorState message={invitations.error} onRetry={invitations.reload} className="py-8" />
        ) : !invitations.data ? (
          <TableSkeleton rows={3} label="A carregar convites" />
        ) : invitations.data.content.length === 0 ? (
          <EmptyState icon={MailCheck} title="Ainda sem convites" text="Convida alguém para a equipa: recebe um link de uso único, válido 72 horas." className="py-8" />
        ) : (
          <>
            <DataTable label="Convites" minWidth={820}>
              <thead>
                <tr>
                  <Th>Para</Th>
                  <Th>Papel</Th>
                  <Th>Estado</Th>
                  <Th>Convidado por</Th>
                  <Th>Validade</Th>
                  <Th align="right"><span className="sr-only">Ações</span></Th>
                </tr>
              </thead>
              <tbody>
                {invitations.data.content.map((i) => {
                  const st = INVITE_STATUS[i.status];
                  return (
                    <Tr key={i.id}>
                      <Td>
                        {i.userId ? (
                          <Link href={`/admin/utilizadores/${i.userId}`} className="font-bold text-verde hover:underline">{i.targetName ?? "Conta"}</Link>
                        ) : (
                          <span className="font-medium text-verde">{i.emailMasked}</span>
                        )}
                        {i.note && <span className="block max-w-64 truncate text-xs text-cinza" title={i.note}>{i.note}</span>}
                      </Td>
                      <Td>{ADMIN_ROLE_LABEL[i.adminRole]}</Td>
                      <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                      <Td className="text-cinza">{i.invitedByName}<span className="block text-xs">{formatDateTime(i.createdAt)}</span></Td>
                      <Td className="text-cinza">
                        {i.status === "ACCEPTED" && i.acceptedAt ? `Aceite a ${formatDateTime(i.acceptedAt)}` : `Até ${formatDateTime(i.expiresAt)}`}
                      </Td>
                      <Td align="right">
                        {i.status === "PENDING" && (
                          <Button variant="ghost" size="sm" className="text-erro" onClick={() => setCancelInvite(i)}>Cancelar</Button>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
            <Pagination page={invPage} size={20} total={pageTotal(invitations.data)} onPage={setInvPage} />
          </>
        )}
      </AdminPanel>

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={invitations.reload} />

      <ConfirmWithReason
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title={roleTarget ? `Mudar ${roleTarget.member.fullName} para ${ADMIN_ROLE_LABEL[roleTarget.role]}?` : ""}
        confirmLabel="Mudar papel"
        placeholder="Ex.: passa a tratar das verificações."
        onConfirm={async (reason) => {
          if (!roleTarget) return;
          try {
            await adminTeamApi.changeRole(roleTarget.member.id, roleTarget.role, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível mudar o papel."));
          }
          members.reload();
          toast.success("Papel alterado. Vale a partir do próximo pedido da pessoa.");
        }}
      >
        {roleTarget && <p className="text-[15px]">{ADMIN_ROLE_SCOPE[roleTarget.role]}</p>}
      </ConfirmWithReason>

      <ConfirmWithReason
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        danger
        title={`Retirar o acesso de ${revokeTarget?.fullName ?? ""} ao Admin?`}
        confirmLabel="Retirar acesso"
        placeholder="Ex.: saiu da equipa."
        onConfirm={async (reason) => {
          if (!revokeTarget) return;
          try {
            await adminTeamApi.revoke(revokeTarget.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível retirar o acesso."));
          }
          reloadAll();
          toast.success("Acesso retirado. As sessões dessa pessoa terminaram.");
        }}
      >
        <p className="text-[15px]">Perde o acesso já, as sessões terminam e a conta volta a &quot;dono e arrendatário&quot;. Para voltar, só com um convite novo.</p>
      </ConfirmWithReason>

      <ConfirmWithReason
        open={cancelInvite !== null}
        onClose={() => setCancelInvite(null)}
        title="Cancelar este convite?"
        confirmLabel="Cancelar convite"
        placeholder="Ex.: enviado para a pessoa errada."
        onConfirm={async (reason) => {
          if (!cancelInvite) return;
          try {
            await adminTeamApi.revokeInvitation(cancelInvite.id, reason);
          } catch (e) {
            throw new Error(errorText(e, "Não foi possível cancelar."));
          }
          invitations.reload();
          toast.success("Convite cancelado. O link deixou de funcionar.");
        }}
      >
        <p className="text-[15px]">O link deixa de funcionar. Podes enviar outro convite a seguir.</p>
      </ConfirmWithReason>
    </div>
  );
}

type TargetKind = "conta" | "email";

/** Convidar: escolher a conta (ou email) e o papel. Mostra o link uma vez, para enviar por WhatsApp. */
function InviteSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<TargetKind>("conta");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<AdminUserSummary | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("OPERATIONS");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<TeamInvitation | null>(null);

  const results = useResource<Page<AdminUserSummary>>(
    kind === "conta" && !picked && q.trim().length >= 2 ? `admin:invite-search:${q.trim()}` : null,
    () => adminUsersApi.search({ q: q.trim(), size: 6, status: "ACTIVE" }),
  );

  function reset() {
    setKind("conta");
    setQ("");
    setPicked(null);
    setEmail("");
    setRole("OPERATIONS");
    setNote("");
    setError(undefined);
    setCreated(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    setError(undefined);
    if (kind === "conta" && !picked) return setError("Escolhe a conta da pessoa.");
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escreve um email válido.");
    setBusy(true);
    try {
      const inv = await adminTeamApi.invite({
        userId: kind === "conta" ? picked!.id : undefined,
        email: kind === "email" ? email.trim() : undefined,
        adminRole: role,
        note: note.trim() || undefined,
      });
      setCreated(inv);
      onDone();
    } catch (e) {
      setError(errorText(e, "Não foi possível criar o convite."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={created ? "Convite criado" : "Convidar para a equipa"}
      className="md:max-w-xl"
      footer={
        created ? (
          <Button variant="dark" block onClick={close}>Fechar</Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button variant="dark" block loading={busy} onClick={submit}>Criar convite</Button>
          </div>
        )
      }
    >
      {created ? (
        <div className="grid gap-3 pt-2 text-[15px]">
          <p>
            {created.emailSent ? "Enviámos o link por email. " : ""}Podes também enviá-lo por WhatsApp. A pessoa tem de entrar na conta dela e abrir o link
            para aceitar. Vale 72 horas e só uma vez.
          </p>
          {created.inviteUrl && (
            <div className="grid gap-2 rounded-campo border border-borda bg-areia p-3">
              <code className="text-[13px] break-all text-verde">{created.inviteUrl}</code>
              <div>
                <Button variant="outline" size="sm" onClick={() => copyText(created.inviteUrl!, "Link")}>
                  <Copy strokeWidth={1.8} /> Copiar link
                </Button>
              </div>
            </div>
          )}
          <p className="text-sm text-cinza">Este link não volta a ser mostrado. Se se perder, cancela o convite e cria outro.</p>
        </div>
      ) : (
        <div className="grid gap-4 pt-2">
          <Segmented<TargetKind>
            label="Quem convidar"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setError(undefined);
            }}
            options={[
              { value: "conta", label: "Conta existente" },
              { value: "email", label: "Por email" },
            ]}
          />
          {kind === "conta" ? (
            picked ? (
              <div className="flex items-center justify-between gap-3 rounded-campo border border-borda-forte px-3 py-2">
                <span className="grid">
                  <span className="font-bold text-verde">{picked.fullName}</span>
                  <span className="text-[13px] text-cinza">{picked.phone}{picked.email ? ` · ${picked.email}` : ""}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Trocar</Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <SearchInput label="Procurar conta" value={q} onChange={setQ} placeholder="Nome, telefone ou email (2+ letras)" />
                {results.data && (
                  <ul className="grid overflow-hidden rounded-campo border border-borda" aria-label="Resultados">
                    {results.data.content.length === 0 && <li className="px-3 py-2 text-sm text-cinza">Ninguém encontrado.</li>}
                    {results.data.content.map((u) => (
                      <li key={u.id} className="border-b border-borda last:border-0">
                        <button
                          type="button"
                          disabled={u.role === "ADMIN"}
                          onClick={() => setPicked(u)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-areia disabled:opacity-50"
                        >
                          <span className="grid">
                            <span className="font-medium text-verde">{u.fullName}</span>
                            <span className="text-[13px] text-cinza">{u.phone}</span>
                          </span>
                          {u.role === "ADMIN" && <span className="text-xs text-cinza">já é da equipa</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          ) : (
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              hint="A pessoa aceita com a conta Beeznoo que tem este email, depois de o confirmar."
              maxLength={255}
            />
          )}
          <RadioCards<AdminRole>
            legend="Papel"
            name="papel-convite"
            value={role}
            onChange={setRole}
            columns={2}
            options={ROLES.map((r) => ({ value: r, title: ADMIN_ROLE_LABEL[r], text: ADMIN_ROLE_SCOPE[r] }))}
          />
          <TextArea label="Nota (opcional)" value={note} onChange={setNote} rows={2} maxLength={500} placeholder="Ex.: entra para tratar das verificações." />
          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}
