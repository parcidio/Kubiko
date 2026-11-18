import { request } from "./api";
import type {
  AdminPermission, AdminRole, AdminUserDetail, AdminUserSummary, AuditLog, BookingStatus, KycStatus, Page, UserRole,
} from "./types";

/**
 * Admin: equipa e acessos (por convite), gestão de contas e reservas — decisoes-produto.md 2026-11-18.
 * A API decide as permissões; o frontend só esconde o que a pessoa não pode usar.
 */

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface MyAdminAccess {
  profileId: string;
  fullName: string;
  adminRole: AdminRole | null;
  permissions: AdminPermission[];
}

export interface TeamMember {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  adminRole: AdminRole | null;
  createdAt: string;
  lastAdminLoginAt: string | null;
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface TeamInvitation {
  id: string;
  userId: string | null;
  targetName: string | null;
  emailMasked: string | null;
  adminRole: AdminRole;
  note: string | null;
  status: InvitationStatus;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** só na resposta de criar: mostrar uma vez */
  inviteUrl: string | null;
  emailSent: boolean;
}

export interface InvitationPreview {
  adminRole: AdminRole;
  invitedByName: string;
  expiresAt: string;
  status: InvitationStatus;
  forYou: boolean;
  problem: string | null;
}

export interface AdminUserNote {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface AdminBookingRow {
  id: string;
  itemId: string;
  itemTitle: string;
  renterId: string;
  renterName: string;
  ownerId: string;
  ownerName: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

export type KycFilter = KycStatus | "NONE";
export type UserSort = "createdAt" | "name" | "items";

export interface UserFilters {
  q?: string;
  role?: UserRole;
  kyc?: KycFilter;
  status?: "ACTIVE" | "SUSPENDED";
  phoneVerified?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?: UserSort;
  direction?: "asc" | "desc";
  page?: number;
  size?: number;
}

// ── API ───────────────────────────────────────────────────────────────────

export const adminAccessApi = {
  me: () => request<MyAdminAccess>("/admin/access/me"),
};

/** Só SUPER_ADMIN (permissão TEAM). */
export const adminTeamApi = {
  members: () => request<TeamMember[]>("/admin/team"),
  changeRole: (id: string, adminRole: AdminRole, reason: string) => request<TeamMember>(`/admin/team/${id}/role`, json("PATCH", { adminRole, reason })),
  revoke: (id: string, reason: string) => request<void>(`/admin/team/${id}/revoke`, json("POST", { reason })),
  invitations: (page = 0) => request<Page<TeamInvitation>>(`/admin/team/invitations?page=${page}&size=20`),
  invite: (b: { userId?: string; email?: string; adminRole: AdminRole; note?: string }) =>
    request<TeamInvitation>("/admin/team/invitations", json("POST", b)),
  revokeInvitation: (id: string, reason: string) => request<TeamInvitation>(`/admin/team/invitations/${id}/revoke`, json("POST", { reason })),
};

/** Lado de quem é convidado (qualquer sessão). O token vai no corpo, nunca no URL. */
export const teamInviteApi = {
  inspect: (token: string) => request<InvitationPreview>("/team-access/invitations/inspect", json("POST", { token })),
  accept: (token: string) => request<{ adminRole: AdminRole; reauthRequired: boolean }>("/team-access/invitations/accept", json("POST", { token })),
};

export const adminUsersApi = {
  search: (f: UserFilters) => {
    const sp = new URLSearchParams({ page: String(f.page ?? 0), size: String(f.size ?? 25) });
    if (f.q) sp.set("q", f.q);
    if (f.role) sp.set("role", f.role);
    if (f.kyc) sp.set("kyc", f.kyc);
    if (f.status) sp.set("status", f.status);
    if (f.phoneVerified !== undefined) sp.set("phoneVerified", String(f.phoneVerified));
    if (f.createdFrom) sp.set("createdFrom", f.createdFrom);
    if (f.createdTo) sp.set("createdTo", f.createdTo);
    if (f.sort) sp.set("sort", f.sort);
    if (f.direction) sp.set("direction", f.direction);
    return request<Page<AdminUserSummary>>(`/admin/users?${sp}`);
  },
  detail: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
  history: (id: string, page = 0) => request<Page<AuditLog>>(`/admin/users/${id}/history?page=${page}&size=20`),
  notes: (id: string) => request<AdminUserNote[]>(`/admin/users/${id}/notes`),
  addNote: (id: string, body: string) => request<AdminUserNote>(`/admin/users/${id}/notes`, json("POST", { body })),
  suspend: (id: string, reason: string) => request<AdminUserSummary>(`/admin/users/${id}/suspend`, json("POST", { reason })),
  reinstate: (id: string, reason: string) => request<AdminUserSummary>(`/admin/users/${id}/reinstate`, json("POST", { reason })),
  revokeSessions: (id: string, reason: string) => request<AdminUserSummary>(`/admin/users/${id}/sessions/revoke`, json("POST", { reason })),
  resetPhone: (id: string, reason: string) => request<AdminUserSummary>(`/admin/users/${id}/phone-verification/reset`, json("POST", { reason })),
};

export const adminBookingsApi = {
  list: (f: { status?: BookingStatus; q?: string; page?: number }) => {
    const sp = new URLSearchParams({ page: String(f.page ?? 0), size: "25" });
    if (f.status) sp.set("status", f.status);
    if (f.q) sp.set("q", f.q);
    return request<Page<AdminBookingRow>>(`/admin/bookings?${sp}`);
  },
  history: (id: string) => request<Page<AuditLog>>(`/admin/bookings/${id}/history?size=50`),
};

// ── Rótulos ───────────────────────────────────────────────────────────────

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  OPERATIONS: "Operações",
  TRUST: "Confiança",
  GROWTH: "Crescimento",
};

export const ADMIN_ROLE_SCOPE: Record<AdminRole, string> = {
  SUPER_ADMIN: "Tudo, incluindo equipa e acessos, auditoria e segurança.",
  OPERATIONS: "Reservas, pagamentos, cauções e problemas. Vê utilizadores e escreve notas.",
  TRUST: "Verificações e utilizadores (suspender, terminar sessões, repor telefone).",
  GROWTH: "Mensagens, zonas e mapa. Vê utilizadores para escolher destinatários.",
};

/** Mensagens para os códigos 409 da API (equipa, convites e contas). */
export const ADMIN_CONFLICT: Record<string, string> = {
  self_change: "Não podes mudar o teu próprio acesso. Pede a outra pessoa da equipa.",
  last_super_admin: "Tem de ficar pelo menos um super admin. Dá esse papel a outra pessoa primeiro.",
  member_not_found: "Esta pessoa já não faz parte da equipa.",
  already_admin: "Esta pessoa já faz parte da equipa.",
  account_suspended: "Esta conta está suspensa. Reativa-a primeiro.",
  invite_pending: "Já há um convite pendente para esta pessoa. Cancela-o antes de enviar outro.",
  invitation_not_pending: "Este convite já não está pendente.",
  team_account: "Contas da equipa não se alteram aqui. Retira primeiro o acesso em Equipa e acessos.",
  self_action: "Não podes fazer isto à tua própria conta.",
  already_suspended: "Esta conta já está suspensa.",
  not_suspended: "Esta conta não está suspensa.",
  phone_not_verified: "O telefone desta conta já está por confirmar.",
  invitation_used: "Este convite já foi usado.",
  invitation_revoked: "Este convite foi cancelado. Pede um novo à equipa.",
  invitation_expired: "Este convite expirou. Pede um novo à equipa.",
  phone_unverified: "Confirma o teu número de telefone antes de aceitar.",
  email_unverified: "Confirma o teu email em Conta antes de aceitar o convite.",
  not_for_you: "Este convite é para outra conta. Entra com a conta convidada.",
  invitation_invalid: "Este convite não existe ou o link está incompleto.",
};
