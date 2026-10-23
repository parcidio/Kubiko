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
  createdAt: string;
}

export interface Item {
  id: string;
  ownerId: string;
  ownerName: string;
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
}

export type BookingStatus =
  | "PENDING_OWNER"
  | "ACCEPTED"
  | "CANCELLED_RENTER"
  | "CANCELLED_OWNER"
  | "ACTIVE"
  | "COMPLETED"
  | "DISPUTED";

export interface Booking {
  id: string;
  itemId: string;
  itemTitle: string;
  itemCoverPhoto: string | null;
  renterId: string;
  renterName: string;
  ownerId: string;
  ownerName: string;
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
