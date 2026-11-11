// Tipos espelhados dos DTOs do backend (com.beeznoo.api.*.dto).

export type UserRole = "OWNER" | "RENTER" | "BOTH" | "ADMIN";

// Web: o refresh vem num cookie httpOnly (bz_refresh), nunca no corpo.
// mfaRequired (contas ADMIN): sem tokens — pedir o código SMS e chamar authApi.loginMfa.
export interface AuthResponse {
  accessToken: string | null;
  refreshToken?: string | null;
  expiresIn: number;
  mfaRequired?: boolean;
  mfaPhoneHint?: string | null;
  mfaToken?: string | null;
}

export interface Page<T> {
  content: T[];
  // Spring Data serializa como PagedModel ({ page: {...} }) ou PageImpl (campos no topo)
  page?: { size: number; number: number; totalElements: number; totalPages: number };
  totalPages?: number;
  number?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  parentId: string | null;
}

export type ItemCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR";

export interface ItemSummary {
  id: string;
  title: string;
  condition: ItemCondition;
  pricePerDay: number;
  province: string | null;
  city: string | null;
  status: string;
  coverPhoto: string | null;
  /** Slug da categoria — escolhe o ícone quando não há foto */
  categorySlug: string | null;
  createdAt: string;
  /** Média 1–5 com 1 casa; null sem avaliações */
  ratingAverage: number | null;
  ratingCount: number;
  completedRentals: number;
  featured: boolean;
  /** KYC do dono aprovado (selo "Verificado") */
  ownerVerified: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  /** Encurtado pela API: "Ana D." */
  reviewerName: string;
  createdAt: string;
}

export type ItemOrder = "RECENT" | "POPULAR" | "RATING";

export interface Item {
  id: string;
  ownerId: string;
  ownerName: string;
  /** KYC do dono aprovado (selo "Verificado") */
  ownerVerified: boolean;
  category: Category | null;
  title: string;
  description: string | null;
  condition: ItemCondition;
  pricePerDay: number;
  depositAmount: number | null;
  province: string | null;
  city: string | null;
  status: string;
  photos: { id: string; photUrl: string; position: number }[];
  ratingAverage: number | null;
  ratingCount: number;
  completedRentals: number;
  featured: boolean;
}

export type BookingStatus =
  | "PENDING_OWNER"
  | "ACCEPTED"
  | "CANCELLED_RENTER"
  | "CANCELLED_OWNER"
  | "EXPIRED"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "RETURNED"
  | "COMPLETED"
  | "DISPUTED";

export interface Booking {
  id: string;
  itemId: string;
  itemTitle: string;
  itemCoverPhoto: string | null;
  renterId: string;
  renterName: string;
  /** KYC aprovado (selo "Verificado") */
  renterVerified: boolean;
  ownerId: string;
  ownerName: string;
  ownerVerified: boolean;
  startDate: string;
  endDate: string;
  totalPrice: number;
  depositAmount: number;
  status: BookingStatus;
  renterMessage: string | null;
  ownerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Dias indisponíveis, INCLUSIVOS (start <= dia <= end). BOOKED = reserva aceite/em curso; BLOCKED = o dono bloqueou. */
export interface UnavailableRange {
  start: string;
  end: string;
  reason: "BOOKED" | "BLOCKED";
}

export interface Availability {
  itemId: string;
  from: string;
  to: string;
  unavailable: UnavailableRange[];
}

/** Bloqueio do dono (dias inclusivos). A nota só o dono vê. */
export interface AvailabilityBlock {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
}

/** Contrato congelado da reserva (gerado quando o dono aceita). */
export interface Contract {
  id: string;
  bookingId: string;
  version: string;
  body: string;
  bodySha256: string;
  ownerAcceptedAt: string;
  renterAcceptedAt: string | null;
  fullyAccepted: boolean;
  createdAt: string;
}

export type ChecklistType = "DELIVERY" | "RETURN";

/** Entrega ou devolução registada por uma parte e confirmada pela outra. URLs das fotos expiram em photosExpireAt. */
export interface Checklist {
  id: string;
  bookingId: string;
  type: ChecklistType;
  createdById: string;
  createdByName: string;
  notes: string;
  photos: { id: string; url: string; position: number }[];
  photosExpireAt: string;
  confirmed: boolean;
  confirmedById: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

/** Caução de uma reserva (fila do admin: HELD em reservas RETURNED ou DISPUTED, mais antiga primeiro). */
export interface Deposit {
  id: string;
  bookingId: string;
  itemTitle: string;
  renterName: string;
  ownerName: string;
  bookingStatus: BookingStatus;
  amount: number;
  status: "HELD" | "RELEASED" | "WITHHELD";
  /** Quanto ficou para o dono (0 se libertada) */
  withheldAmount: number | null;
  reason: string | null;
  heldAt: string;
  decidedAt: string | null;
}

export type IncidentType = "DAMAGE" | "LOSS" | "THEFT" | "OTHER";

/** Problema reportado. URLs das fotos expiram em photosExpireAt (10 min). */
export interface Incident {
  id: string;
  bookingId: string;
  itemTitle: string;
  bookingStatus: BookingStatus;
  reporterId: string;
  reporterName: string;
  type: IncidentType;
  description: string;
  status: "OPEN" | "RESOLVED";
  resolutionNote: string | null;
  resolvedAt: string | null;
  photos: { id: string; url: string; position: number }[];
  photosExpireAt: string;
  createdAt: string;
}

/** Linha da fila de pagamentos do admin. */
export interface AdminPayment {
  id: string;
  bookingId: string;
  itemTitle: string;
  renterId: string;
  renterName: string;
  entity: string | null;
  reference: string | null;
  amount: number;
  status: PaymentStatus;
  expiresAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH";

export interface SecurityEvent {
  id: string;
  type: string;
  severity: SecuritySeverity;
  profileId: string | null;
  ip: string | null;
  requestId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export type PaymentStatus = "AWAITING_PAYMENT" | "CONFIRMED" | "EXPIRED" | "CANCELLED" | "FAILED";

export interface Payment {
  id: string;
  bookingId: string;
  method: "REFERENCE" | "MANUAL";
  entity: string | null;
  reference: string | null;
  rentalAmount: number;
  serviceFee: number;
  depositAmount: number;
  amount: number;
  status: PaymentStatus;
  expiresAt: string;
  confirmedAt: string | null;
  /** Nº do comprovativo ("CP 2026/000001") quando CONFIRMED — PDF em documentApi.receipt */
  receiptNumber: string | null;
}

export interface Account {
  id: string;
  availableBalance: number;
  heldBalance: number;
  currency: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}
