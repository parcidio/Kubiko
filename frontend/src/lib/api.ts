import { readSession, toSession, writeSession } from "./session";
import type {
  Account, AuthResponse, Booking, Category, Item, ItemCondition, ItemSummary, LedgerEntry, Page, Payment, UserRole,
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

async function refreshTokens(): Promise<boolean> {
  const session = readSession();
  if (!session) return false;
  refreshing ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
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
  if (init.body) headers.set("Content-Type", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, headers });
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
  logout: () => post<void>("/auth/logout"),
};

export const catalogApi = {
  categories: () => request<Category[]>("/categories"),
  items: (p: { categoryId?: string; page?: number }) => {
    const q = new URLSearchParams({ page: String(p.page ?? 0), size: "20", sort: "createdAt,desc" });
    if (p.categoryId) q.set("categoryId", p.categoryId);
    return request<Page<ItemSummary>>(`/items?${q}`);
  },
  item: (id: string) => request<Item>(`/items/${id}`),
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
};

export const walletApi = {
  account: () => request<Account>("/accounts/me"),
  statement: (page = 0) => request<Page<LedgerEntry>>(`/accounts/me/statement?page=${page}&size=30&sort=createdAt,desc`),
};

/** Ações de admin que já existem (sem listagens — ver docs/BACKEND_GAPS.md). */
export const adminApi = {
  confirmPayment: (bookingId: string) => patch<Booking>(`/bookings/${bookingId}/confirm-payment`),
  complete: (bookingId: string) => patch<Booking>(`/bookings/${bookingId}/complete`),
};

export const paymentApi = {
  current: (bookingId: string) => request<Payment | undefined>(`/bookings/${bookingId}/payments/current`),
  create: (bookingId: string) => post<Payment>(`/bookings/${bookingId}/payments`),
  check: (paymentId: string) => post<Payment>(`/payments/${paymentId}/check`),
};
