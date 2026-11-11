import { readSession, toSession, writeSession } from "./session";
import type {
  Account, AdminPayment, AuditLog, Availability, AvailabilityBlock, AuthResponse, Booking, Category, Checklist, ChecklistType, Contract, Deposit, Incident,
  IncidentType, Item, ItemCondition, ItemOrder, ItemSummary, LedgerEntry, Page, Payment, Review, SecurityEvent,
  SecuritySeverity, UserRole,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

const NETWORK_ERROR = "Sem ligação. Verifica a internet e tenta outra vez.";

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.message ?? body.error ?? "Algo correu mal.", body.fields ?? undefined);
  } catch {
    return new ApiError(res.status, res.status >= 500 ? "O servidor falhou. Tenta outra vez." : "Algo correu mal.");
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

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  headers.set("X-Beeznoo-Client", CLIENT_HEADER["X-Beeznoo-Client"]);
  if (init.body) headers.set("Content-Type", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
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
    throw new ApiError(0, NETWORK_ERROR);
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
    throw new ApiError(0, NETWORK_ERROR);
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
  register: (b: { fullName: string; phone: string; email?: string; password: string; role: UserRole }) =>
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
  // 2FA de contas ADMIN: desafio do 1.º passo + código SMS
  loginMfa: (b: { mfaToken: string; code: string }) => post<AuthResponse>("/auth/login/mfa", b),
  changePassword: (b: { currentPassword: string; newPassword: string }) => post<AuthResponse>("/auth/password/change", b),
};

export const catalogApi = {
  categories: () => request<Category[]>("/categories"),
  // order: RECENT (destaques primeiro) · POPULAR (mais alugados) · RATING (mais bem avaliados)
  // startDate + endDate (as duas): só equipamento livre nesse período (o dia de devolução é exclusivo)
  items: (p: { categoryId?: string; page?: number; size?: number; featured?: boolean; order?: ItemOrder; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams({ page: String(p.page ?? 0), size: String(p.size ?? 20) });
    if (p.categoryId) q.set("categoryId", p.categoryId);
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

/** Equipamento do dono autenticado. */
export const ownerItemApi = {
  mine: (page = 0) => request<Page<ItemSummary>>(`/items/me?page=${page}&size=50&sort=createdAt,desc`),
  publish: (b: ItemInput) => post<Item>("/items", b),
  // UpdateItemRequest usa "condition" (o publish usa "itemCondition")
  update: (id: string, { itemCondition, ...b }: Partial<ItemInput>) => patch<Item>(`/items/${id}`, { ...b, condition: itemCondition }),
  deactivate: (id: string) => patch<void>(`/items/${id}/deactivate`),
  // Pausado → ativo (SUSPENDED é da equipa e devolve 409)
  activate: (id: string) => patch<Item>(`/items/${id}/activate`),
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
  // Motivo fica em audit_logs
  confirmPayment: (bookingId: string, reason?: string) => patch<Booking>(`/bookings/${bookingId}/confirm-payment`, { reason }),
  complete: (bookingId: string) => patch<Booking>(`/bookings/${bookingId}/complete`),
  // Filas: mais antigo primeiro
  payments: (page = 0, size = 50) => request<Page<AdminPayment>>(`/admin/payments?status=AWAITING_PAYMENT&page=${page}&size=${size}`),
  // Só a contagem (o ecrã de verificações ainda não está ligado)
  kycQueue: (page = 0, size = 50) => request<Page<unknown>>(`/admin/kyc?page=${page}&size=${size}`),
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
  create: (bookingId: string) => post<Payment>(`/bookings/${bookingId}/payments`),
  check: (paymentId: string) => post<Payment>(`/payments/${paymentId}/check`),
};

/** PDFs: contrato (partes da reserva) e comprovativo de pagamento não fiscal (quem pagou). */
export const documentApi = {
  contract: (bookingId: string) => download(`/bookings/${bookingId}/contract/pdf`, "contrato.pdf"),
  receipt: (paymentId: string) => download(`/payments/${paymentId}/receipt`, "comprovativo.pdf"),
};
