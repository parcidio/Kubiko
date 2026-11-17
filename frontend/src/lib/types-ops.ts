// Admin: papéis, mensagens, zonas de serviço, mapa e localização (docs/API_ADMIN_MESSAGES_GEO.md, 2026-11-17).

export type MessageChannel = "WHATSAPP" | "EMAIL" | "SMS";

export type MessageAudience =
  | { type: "USERS"; userIds: string[] }
  | { type: "ALL" }
  | { type: "VERIFIED" }
  | { type: "UNVERIFIED" }
  | { type: "CITY"; areaId: string };

export interface MessageTemplate {
  id: string;
  key: string | null;
  name: string;
  /** null = serve para qualquer canal */
  channel: MessageChannel | null;
  subject: string | null;
  body: string;
  predefined: boolean;
  updatedAt: string;
}

export interface MessageTemplateInput {
  name: string;
  subject?: string;
  body: string;
  channel?: MessageChannel;
}

export interface MessageInput {
  channel: MessageChannel;
  audience: MessageAudience;
  templateId?: string;
  subject?: string;
  body?: string;
}

export interface MessagePreview {
  recipients: number;
  reachable: number;
  /** noPhone, noEmail, foreignNoWhatsapp, foreignSms… (a API pode acrescentar motivos) */
  skipped: Record<string, number>;
  sample: { subject: string | null; body: string } | null;
}

export interface WhatsAppCheck {
  phone: string;
  /** null = gateway indisponível */
  hasWhatsApp: boolean | null;
  international: boolean;
}

export interface AdminMessageSummary {
  id: string;
  channel: MessageChannel;
  subject: string | null;
  bodyPreview: string;
  audienceLabel: string;
  recipients: number;
  sent: number;
  failed: number;
  pending: number;
  createdAt: string;
  createdBy: string;
}

export type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface MessageDelivery {
  userId: string;
  name: string;
  destinationMasked: string | null;
  status: DeliveryStatus;
  error: string | null;
  sentAt: string | null;
}

/** GET /admin/messages/{id}: os campos do envio + as entregas. */
export interface AdminMessageDetail extends AdminMessageSummary {
  body?: string | null;
  deliveries: MessageDelivery[];
}

export interface ServiceArea {
  id: string;
  province: string;
  city: string;
  lat: number;
  lng: number;
  radiusKm: number;
  active: boolean;
}

export type ServiceAreaInput = Omit<ServiceArea, "id">;

export type LocationContext = "SIGNUP" | "KYC" | "PUBLISH" | "APP";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationResult {
  inServiceArea: boolean;
  area: { province: string; city: string } | null;
}

export interface PublishEligibility {
  allowed: boolean;
  reason: null | "location_required" | "area_not_available";
  areas: { id?: string; province: string; city: string }[];
}

export type HeatmapScope = "KYC_APPROVED" | "KYC_SUBMITTED" | "SIGNUP";

export interface Heatmap {
  cellSizeDeg: number;
  minCount: number;
  cells: { lat: number; lng: number; count: number }[];
  byProvince: { province: string; count: number }[];
  outsideAreas: number;
}
