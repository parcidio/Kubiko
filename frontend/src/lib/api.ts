import { readSession, toSession, writeSession } from "./session";
import type {
  Account, AdminMetrics, AdminPayment, AdminUserDetail, AdminUserSummary, AppNotification, Me, AuditLog, Availability, AvailabilityBlock, AuthResponse, Booking, Category, Checklist, ChecklistType,
  CommissionDue, Contract, Deposit, DirectChannel, Incident, IncidentType, Item, ItemCondition, ItemOrder, ItemSummary, KycAccountType, KycDetail,
  KycQueueFilter, KycQueueItem, KycStatusInfo, LedgerEntry, MyCommissions, Page, Payment, Review, SecurityEvent, SecuritySeverity, UserRole,
} from "./types";
import type { LatLng } from "./types-ops";
import { docT } from "./i18n";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>, public code?: string) {
    super(message);
  }
}

// Mensagens geradas no browser (as da API chegam já escritas e passam tal como vêm)
const NETWORK_ERROR = () => docT().common.networkError;

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.message ?? body.error ?? docT().common.somethingWrong, body.fields ?? undefined, typeof body.code === "string" ? body.code : undefined);
  } catch {
    return new ApiError(res.status, res.status >= 500 ? docT().common.serverError : docT().common.somethingWrong);
  }
}

let refreshing: Promise<boolean> | null = null;

// Identifica o cliente web: a API devolve o refresh num cookie httpOnly em vez do corpo
const CLIENT_HEADER = { "X-Beeznoo-Client": "web" };

async function refreshTokens(): Promise<boolean> {
  const session = readSession();
  if (!session) return false;
  // o cookie bz_refresh vai sozinho (mesma origem, via proxy do Next)
  refreshing ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: CLIENT_HEADER,
    credentials: "same-origin",
  })
    .then(async (res) => {
      if (!res.ok) {
        writeSession(null);
        return false;
      }
      writeSession(toSession(await res.json()));
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

/**
 * Renova o access token já (cookie bz_refresh). Serve para apanhar uma mudança de papel feita por outra pessoa da
 * equipa (o papel vai no token). Devolve false se a sessão já não for válida (a sessão local é limpa).
 */
export function refreshSession(): Promise<boolean> {
  return refreshTokens();
}

/** Sinal que cancela o pedido ao fim de `ms` (rede instável: nada fica pendurado para sempre). */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  headers.set("X-Beeznoo-Client", CLIENT_HEADER["X-Beeznoo-Client"]);
  if (init.body) headers.set("Content-Type", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "same-origin" });
  } catch (e) {
    const timedOut = init.signal?.aborted || (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"));
    throw new ApiError(0, timedOut ? docT().common.timeoutError : NETWORK_ERROR());
  }

  if (res.status === 401 && session && retry && (await refreshTokens())) {
    return request<T>(path, init, false);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Descarrega um ficheiro autenticado (PDF do contrato, comprovativo). O token não pode ir num link simples. */
async function download(path: string, fallbackName: string, retry = true): Promise<void> {
  const session = readSession();
  const headers = new Headers(CLIENT_HEADER);
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, NETWORK_ERROR());
  }
  if (res.status === 401 && session && retry && (await refreshTokens())) return download(path, fallbackName, false);
  if (!res.ok) throw await parseError(res);

  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Envia fotos em multipart (o browser põe o Content-Type com o boundary). */
async function upload<T>(path: string, form: FormData, retry = true): Promise<T> {
  const session = readSession();
  const headers = new Headers(CLIENT_HEADER);
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method: "POST", body: form, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, NETWORK_ERROR());
  }
  if (res.status === 401 && session && retry && (await refreshTokens())) return upload<T>(path, form, false);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export function totalPages(page: Page<unknown>) {
  return page.page?.totalPages ?? page.totalPages ?? 1;
}

export const authApi = {
  // location: opcional, com consentimento (lib/location.ts, arredondada a 2 casas)
  register: (b: { fullName: string; phone: string; email?: string; password: string; role: UserRole; location?: LatLng }) =>
    post<void>("/auth/register", b),
  verifyRegistration: (b: { phone: string; code: string }) => post<AuthResponse>("/auth/register/verify", b),
  login: (b: { phone?: string; email?: string; password: string }) => post<AuthResponse>("/auth/login", b),
  requestReset: (b: { phone: string }) => post<void>("/auth/password/reset/request", b),
  confirmReset: (b: { phone: string; code: string; newPassword: string }) =>
    post<void>("/auth/password/reset/confirm", b),
  googleRegister: (b: { pendingToken: string; phone: string; role: UserRole }) =>
    post<void>("/auth/google/register", b),
  googleVerify: (b: { pendingToken: string; code: string }) => post<AuthResponse>("/auth/google/verify", b),
  // Código de uso único (60 s) do redirect do Google → tokens. Os tokens nunca vêm na URL.
  googleExchange: (code: string) => post<AuthResponse>("/auth/google/exchange", { code }),
  logout: () => post<void>("/auth/logout"),
  // 2FA de contas ADMIN: desafio do 1.º passo + código (WhatsApp ou SMS)
  loginMfa: (b: { mfaToken: string; code: string }) => post<AuthResponse>("/auth/login/mfa", b),
  changePassword: (b: { currentPassword: string; newPassword: string }) => post<AuthResponse>("/auth/password/change", b),
  /**
   * Associar Google com a sessão iniciada: a API guarda a intenção na sessão OAuth2 (cookie httpOnly) e o browser
   * segue para o Google. Volta a /conta?google=linked|already|conflict.
   */
  linkGoogle: async () => {
    await post<void>("/auth/google/link");
    // navegação completa de propósito: /oauth2/* não é uma página do Next, é o proxy para a API (next.config.ts)
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/oauth2/authorization/google");
  },
};

/** Avisos na app. A contagem é consultada a cada ~60 s (lib/notifications.ts). */
export const notificationApi = {
  mine: () => request<AppNotification[]>("/notifications/me"),
  unreadCount: () => request<{ unread: number }>("/notifications/me/unread-count"),
  markRead: (id: string) => patch<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => post<{ updated: number }>("/notifications/me/read-all"),
};

/** Perfil da pessoa autenticada. */
export const profileApi = {
  me: () => request<Me>("/profiles/me"),
  // null = não mexe; email "" = remover
  update: (b: { fullName?: string; email?: string; province?: string; city?: string }) => patch<Me>("/profiles/me", b),
  // 409 se o envio de emails estiver desligado no servidor
  requestEmailCode: () => post<void>("/profiles/me/email/verification"),
  confirmEmail: (code: string) => post<Me>("/profiles/me/email/verification/confirm", { code }),
};

export const catalogApi = {
  categories: () => request<Category[]>("/categories"),
  // order: RECENT (destaques primeiro) · POPULAR (mais alugados) · RATING (mais bem avaliados)
  // startDate + endDate (as duas): só equipamento livre nesse período (o dia de devolução é exclusivo)
  items: (p: {
    categoryId?: string; page?: number; size?: number; featured?: boolean; order?: ItemOrder; startDate?: string; endDate?: string;
    // pesquisa no servidor (#17): título, cidade/província, Kz por dia, estado
    text?: string; area?: string; maxPrice?: number; condition?: ItemCondition;
  }) => {
    const q = new URLSearchParams({ page: String(p.page ?? 0), size: String(p.size ?? 20) });
    if (p.categoryId) q.set("categoryId", p.categoryId);
    if (p.text?.trim()) q.set("q", p.text.trim());
    if (p.area?.trim()) q.set("area", p.area.trim());
    if (p.maxPrice !== undefined) q.set("maxPrice", String(p.maxPrice));
    if (p.condition) q.set("condition", p.condition);
    if (p.startDate && p.endDate) {
      q.set("startDate", p.startDate);
      q.set("endDate", p.endDate);
    }
    if (p.featured) q.set("featured", "true");
    if (p.order) q.set("order", p.order);
    return request<Page<ItemSummary>>(`/items?${q}`);
  },
  item: (id: string) => request<Item>(`/items/${id}`),
  // Dias indisponíveis (público). Por omissão: hoje + 180 dias
  availability: (itemId: string, from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request<Availability>(`/items/${itemId}/availability${q.size ? `?${q}` : ""}`);
  },
  reviews: (itemId: string, page = 0) => request<Page<Review>>(`/items/${itemId}/reviews?page=${page}&size=10`),
};

export interface ItemInput {
  title: string;
  description?: string;
  categoryId: string;
  itemCondition: ItemCondition;
  pricePerDay: number;
  depositAmount?: number;
  province?: string;
  city?: string;
}

/** Onde se publica: posição do browser (arredondada), zona escolhida à mão, ou nenhuma (zona guardada na conta). */
export type PublishWhere = { location?: LatLng; areaId?: string };

/** Equipamento do dono autenticado. */
export const ownerItemApi = {
  mine: (page = 0) => request<Page<ItemSummary>>(`/items/me?page=${page}&size=50&sort=createdAt,desc`),
  // Zona: localização do browser, ou zona escolhida à mão (areaId), ou nada → a API usa a zona guardada na conta.
  // Sem nenhuma: 422 location_required; fora das zonas ativas: 403 area_not_available (decisoes-produto.md 2026-11-18)
  publish: (b: ItemInput, where: PublishWhere = {}) => post<Item>("/items", { ...b, ...where }),
  // UpdateItemRequest usa "condition" (o publish usa "itemCondition")
  update: (id: string, { itemCondition, ...b }: Partial<ItemInput>) => patch<Item>(`/items/${id}`, { ...b, condition: itemCondition }),
  deactivate: (id: string) => patch<void>(`/items/${id}/deactivate`),
  // Pausado → ativo (SUSPENDED é da equipa e devolve 409)
  activate: (id: string, where: PublishWhere = {}) =>
    patch<Item>(`/items/${id}/activate`, where.location || where.areaId ? where : undefined),
  // JPEG/PNG até 5 MB, máx. 8 por item. Comprimir antes (lib/images.ts)
  uploadPhotos: (id: string, files: Blob[]) => {
    const form = new FormData();
    files.forEach((f, i) => form.append("photos", f, `foto-${i + 1}.jpg`));
    return upload<Item["photos"]>(`/items/${id}/photos`, form);
  },
  // Bloqueios de datas (dias inclusivos). 409 se tocar numa reserva aceite
  blocks: (id: string) => request<AvailabilityBlock[]>(`/items/${id}/blocks`),
  createBlock: (id: string, b: { startDate: string; endDate: string; note?: string }) => post<AvailabilityBlock>(`/items/${id}/blocks`, b),
  deleteBlock: (id: string, blockId: string) => del<void>(`/items/${id}/blocks/${blockId}`),
  // Devolve as fotos que ficam
  deletePhoto: (id: string, photoId: string) => del<Item["photos"]>(`/items/${id}/photos/${photoId}`),
  remove: (id: string) => del<void>(`/items/${id}`),
};

export const bookingApi = {
  create: (b: { itemId: string; startDate: string; endDate: string; renterMessage?: string }) =>
    post<Booking>("/bookings", b),
  mine: (page = 0) => request<Page<Booking>>(`/bookings/me/renter?page=${page}&size=50&sort=createdAt,desc`),
  get: (id: string) => request<Booking>(`/bookings/${id}`),
  cancel: (id: string, note?: string) => patch<Booking>(`/bookings/${id}/cancel`, { ownerNote: note }),
  // Dono
  received: (page = 0) => request<Page<Booking>>(`/bookings/me/owner?page=${page}&size=50&sort=createdAt,desc`),
  accept: (id: string, note?: string) => patch<Booking>(`/bookings/${id}/accept`, { ownerNote: note }),
  // Arrendatário ou dono, só com a reserva ACTIVE
  dispute: (id: string) => patch<Booking>(`/bookings/${id}/dispute`),
  // Avaliação: só o arrendatário, com a reserva COMPLETED, uma vez. GET devolve undefined (204) se ainda não há.
  review: (id: string) => request<Review | undefined>(`/bookings/${id}/review`),
  createReview: (id: string, b: { rating: number; comment?: string }) => post<Review>(`/bookings/${id}/review`, b),
};

export const walletApi = {
  account: () => request<Account>("/accounts/me"),
  statement: (page = 0) => request<Page<LedgerEntry>>(`/accounts/me/statement?page=${page}&size=30&sort=createdAt,desc`),
};

/** Ações de admin que já existem (sem listagens — ver docs/BACKEND_GAPS.md). */
export const adminApi = {
  // Painel: North Star, funil, comissões, KYC (só leitura)
  metrics: () => request<AdminMetrics>("/admin/metrics"),
  // Motivo fica em audit_logs
  // Pagamento direto: confirmar em nome do dono (motivo e meio obrigatórios)
  confirmPayment: (bookingId: string, reason: string, channel: DirectChannel) =>
    patch<Booking>(`/bookings/${bookingId}/confirm-payment`, { reason, channel }),
  complete: (bookingId: string, reason?: string) => patch<Booking>(`/bookings/${bookingId}/complete`, { reason }),
  // Pagamentos diretos confirmados: mais recentes primeiro
  payments: (page = 0, size = 50) => request<Page<AdminPayment>>(`/admin/payments?status=CONFIRMED&page=${page}&size=${size}`),
  // Comissões por receber dos donos (quem deve há mais tempo primeiro)
  commissions: () => request<CommissionDue[]>("/admin/commissions"),
  settleCommissions: (ownerId: string, reason?: string) =>
    post<{ ownerId: string; payments: number; amount: number }>(`/admin/commissions/${ownerId}/settle`, { reason }),
  // KYC: fila (PENDING e IN_REVIEW, mais antigas primeiro), detalhe com URLs de 5 min, decisão
  // status: OPEN (omissão) = por decidir · INFO_REQUESTED / REJECTED / APPROVED = já saíram da fila · profileId = todas de uma pessoa
  kycQueue: (page = 0, size = 50, filter: { status?: KycQueueFilter; profileId?: string } = {}) => {
    const q = new URLSearchParams({ page: String(page), size: String(size) });
    if (filter.status) q.set("status", filter.status);
    if (filter.profileId) q.set("profileId", filter.profileId);
    return request<Page<KycQueueItem>>(`/admin/kyc?${q}`);
  },
  kycDetail: (id: string) => request<KycDetail>(`/admin/kyc/${id}`),
  kycReview: (id: string, action: "START_REVIEW" | "APPROVE" | "REJECT" | "REQUEST_INFO", note?: string) =>
    patch<KycStatusInfo>(`/admin/kyc/${id}/review`, { action, note }),
  deposits: (page = 0, size = 50) => request<Page<Deposit>>(`/admin/deposits?page=${page}&size=${size}`),
  incidents: (page = 0, size = 50) => request<Page<Incident>>(`/admin/incidents?page=${page}&size=${size}`),
  incident: (id: string) => request<Incident>(`/admin/incidents/${id}`),
  // Libertar = tudo volta ao arrendatário; reter = `amount` (Kz inteiros) fica para o dono, o resto volta
  releaseDeposit: (bookingId: string, reason?: string) => post<Deposit>(`/admin/deposits/${bookingId}/release`, { reason }),
  withholdDeposit: (bookingId: string, amount: number, reason: string) =>
    post<Deposit>(`/admin/deposits/${bookingId}/withhold`, { amount, reason }),
  resolveIncident: (id: string, note: string) => patch<Incident>(`/admin/incidents/${id}/resolve`, { note }),
  setFeatured: (itemId: string, featured: boolean) => patch<Item>(`/admin/items/${itemId}/featured`, { featured }),
  // Auditoria: mais recente primeiro. Filtros opcionais e combináveis
  auditLogs: (f: { entityType?: string; entityId?: string; action?: string; actorId?: string; page?: number }) => {
    const q = new URLSearchParams({ page: String(f.page ?? 0), size: "50" });
    if (f.entityType) q.set("entityType", f.entityType);
    if (f.entityId) q.set("entityId", f.entityId);
    if (f.action) q.set("action", f.action);
    if (f.actorId) q.set("actorId", f.actorId);
    return request<Page<AuditLog>>(`/admin/audit-logs?${q}`);
  },
  securityEvents: (f: { severity?: SecuritySeverity; page?: number }) => {
    const q = new URLSearchParams({ page: String(f.page ?? 0), size: "50" }); // a API já ordena (mais recente primeiro)
    if (f.severity) q.set("severity", f.severity);
    return request<Page<SecurityEvent>>(`/admin/security-events?${q}`);
  },
  // Utilizadores: pesquisa por nome, email ou telefone; suspensão com motivo (auditoria)
  users: (q: string, suspended = false, page = 0, size = 20, adminsOnly = false) => {
    const sp = new URLSearchParams({ q, suspended: String(suspended), page: String(page), size: String(size) });
    if (adminsOnly) sp.set("role", "ADMIN");
    return request<Page<AdminUserSummary>>(`/admin/users?${sp}`);
  },
  user: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
  suspendUser: (id: string, reason: string) => post<AdminUserSummary>(`/admin/users/${id}/suspend`, { reason }),
  // reativar exige motivo (2026-11-18); ações novas em lib/api-admin.ts
  reinstateUser: (id: string, reason: string) => post<AdminUserSummary>(`/admin/users/${id}/reinstate`, { reason }),
  suspendItem: (id: string, reason: string) => patch<Item>(`/admin/items/${id}/suspend`, { reason }),
  reinstateItem: (id: string, reason?: string) => patch<Item>(`/admin/items/${id}/reinstate`, { reason }),
};

/** Contrato da reserva: o arrendatário aceita antes de gerar a referência de pagamento. */
export const contractApi = {
  // 409 enquanto o dono não aceitou o pedido (ainda não há contrato)
  get: (bookingId: string) => request<Contract>(`/bookings/${bookingId}/contract`),
  accept: (bookingId: string) => post<Contract>(`/bookings/${bookingId}/contract/accept`),
};

/** Reportar problema: tipo, descrição e até 6 fotos. A reserva passa a DISPUTED e a equipa é avisada. */
export const incidentApi = {
  list: (bookingId: string) => request<Incident[]>(`/bookings/${bookingId}/incidents`),
  report: (bookingId: string, type: IncidentType, description: string, photos: Blob[]) => {
    const form = new FormData();
    form.append("type", type);
    form.append("description", description);
    photos.forEach((p, i) => form.append("photos", p, `foto-${i + 1}.jpg`));
    return upload<Incident>(`/bookings/${bookingId}/incidents`, form);
  },
};

const CHECKLIST_PATH: Record<ChecklistType, string> = { DELIVERY: "delivery", RETURN: "return" };

/** Entrega e devolução: uma parte regista (notas + 2 a 10 fotos), a outra confirma e a reserva avança. */
export const checklistApi = {
  list: (bookingId: string) => request<Checklist[]>(`/bookings/${bookingId}/checklists`),
  create: (bookingId: string, type: ChecklistType, notes: string, photos: Blob[]) => {
    const form = new FormData();
    form.append("notes", notes);
    photos.forEach((p, i) => form.append("photos", p, `foto-${i + 1}.jpg`));
    return upload<Checklist>(`/bookings/${bookingId}/checklists/${CHECKLIST_PATH[type]}`, form);
  },
  confirm: (bookingId: string, type: ChecklistType) =>
    post<Checklist>(`/bookings/${bookingId}/checklists/${CHECKLIST_PATH[type]}/confirm`),
};

export const paymentApi = {
  current: (bookingId: string) => request<Payment | undefined>(`/bookings/${bookingId}/payments/current`),
  // Pagamento direto (modo por omissão): o dono confirma que recebeu na entrega
  received: (bookingId: string, channel: DirectChannel) => post<Booking>(`/bookings/${bookingId}/payment-received`, { channel }),
  // O dono regista a devolução da caução: withheldAmount 0 = devolveu tudo
  depositDecision: (bookingId: string, withheldAmount: number, reason?: string) =>
    post<Booking>(`/bookings/${bookingId}/deposit/decision`, { withheldAmount, reason }),
  myCommissions: () => request<MyCommissions>("/payments/commissions/me"),
  create: (bookingId: string) => post<Payment>(`/bookings/${bookingId}/payments`),
  check: (paymentId: string) => post<Payment>(`/payments/${paymentId}/check`),
};

/** KYC manual: BI frente/verso + selfie (particular) ou NIF + certidão (empresa). A equipa decide à mão. */
export const kycApi = {
  me: () => request<KycStatusInfo>("/kyc/me"),
  submit: (accountType: KycAccountType, files: Partial<Record<"biFront" | "biBack" | "selfie" | "nifDocument" | "businessDocument", Blob>>) => {
    const form = new FormData();
    form.append("accountType", accountType);
    for (const [k, f] of Object.entries(files)) if (f) form.append(k, f, `${k}.${f.type === "application/pdf" ? "pdf" : "jpg"}`);
    return upload<KycStatusInfo>("/kyc/submit", form);
  },
};

/** PDFs: contrato (partes da reserva) e comprovativo de pagamento não fiscal (quem pagou e, no pagamento direto, quem recebeu). */
export const documentApi = {
  contract: (bookingId: string) => download(`/bookings/${bookingId}/contract/pdf`, "contrato.pdf"),
  receipt: (paymentId: string) => download(`/payments/${paymentId}/receipt`, "comprovativo.pdf"),
};
