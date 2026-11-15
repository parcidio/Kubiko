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

/** Aviso na app (GET /notifications/me: as 50 mais recentes). linkPath = página da app a abrir. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkPath: string | null;
  bookingId: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Perfil da pessoa autenticada (GET /profiles/me). phoneVerified ≠ identityVerified (KYC). */
export interface Me {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  emailVerified: boolean;
  googleLinked: boolean;
  avatarUrl: string | null;
  province: string | null;
  city: string | null;
  role: UserRole;
  accountType: "INDIVIDUAL" | "BUSINESS";
  phoneVerified: boolean;
  identityVerified: boolean;
  kycStatus: string | null;
  createdAt: string;
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
  ownerName: string;
  method: "REFERENCE" | "MANUAL" | "DIRECT";
  channel: DirectChannel | null;
  entity: string | null;
  reference: string | null;
  amount: number;
  serviceFee: number;
  status: PaymentStatus;
  receiptNumber: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  commissionSettledAt: string | null;
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
  method: "REFERENCE" | "MANUAL" | "DIRECT";
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
  /** Pagamento direto ao dono: meio usado */
  channel: DirectChannel | null;
}

/** Meio do pagamento direto ao dono, na entrega (decisoes-produto.md 2026-11-15). */
export type DirectChannel = "CASH" | "TRANSFER" | "MULTICAIXA_EXPRESS";

export const CHANNEL_LABEL: Record<DirectChannel, string> = {
  CASH: "Numerário",
  TRANSFER: "Transferência bancária",
  MULTICAIXA_EXPRESS: "Multicaixa Express",
};

/** Comissão (taxa de serviço) de um pagamento recebido pelo dono. */
export interface CommissionLine {
  paymentId: string;
  bookingId: string;
  itemTitle: string;
  receiptNumber: string | null;
  channel: DirectChannel | null;
  amountReceived: number;
  /** Só o aluguer (o que fica para o dono) */
  rentalAmount: number;
  serviceFee: number;
  confirmedAt: string;
  commissionSettledAt: string | null;
}

export interface MyCommissions {
  due: number;
  lines: CommissionLine[];
}

/** Admin › Comissões: o que cada dono deve. */
export interface CommissionDue {
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  payments: number;
  amount: number;
  oldestConfirmedAt: string;
}

/** KYC (SPEC §7): a equipa decide à mão. */
export type KycStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "INFO_REQUESTED";
export type KycAccountType = "INDIVIDUAL" | "BUSINESS";
export type KycDocumentType = "BI_FRONT" | "BI_BACK" | "SELFIE" | "NIF_DOCUMENT" | "BUSINESS_DOCUMENT";

/** Todos a null se ainda não submeteu. */
export interface KycStatusInfo {
  id: string | null;
  status: KycStatus | null;
  accountType: KycAccountType | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  infoRequestNote: string | null;
}

export interface KycQueueItem {
  id: string;
  profileId: string;
  profileName: string;
  accountType: KycAccountType;
  status: KycStatus;
  submittedAt: string;
}

export interface KycDocument {
  id: string;
  documentType: KycDocumentType;
  contentType: string;
  signedUrl: string;
  expiresAt: string;
  uploadedAt: string;
}

export interface KycDecision {
  id: string;
  action: "START_REVIEW" | "APPROVE" | "REJECT" | "REQUEST_INFO" | "RESUBMIT";
  actorId: string;
  actorName: string;
  note: string | null;
  createdAt: string;
}

export interface KycDetail {
  verification: KycStatusInfo;
  profileId: string;
  profileName: string;
  documents: KycDocument[];
  decisions: KycDecision[];
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

/** GET /admin/metrics — painel de métricas (decisoes-produto.md 2026-11-15). Kz inteiros; meses YYYY-MM no fuso de Luanda. */
export interface AdminMetrics {
  generatedAt: string;
  northStar: { completedThisMonth: number; completedLastMonth: number };
  months: { month: string; completed: number; paid: number; rentalValue: number; serviceFee: number }[];
  funnel30d: { requested: number; accepted: number; paid: number; completed: number; lost: number; pending: number };
  commissions: { earnedThisMonth: number; pendingTotal: number; pendingOwners: number };
  kyc: { pending: number; avgDecisionHours: number | null; decided30d: number };
  marketplace: { users: number; newUsers30d: number; verifiedUsers: number; activeItems: number; ownersWithItems: number };
}
