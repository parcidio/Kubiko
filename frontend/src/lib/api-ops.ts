import { request } from "./api";
import type { AdminUserSummary, Page } from "./types";
import type {
  AdminMessageDetail, AdminMessageSummary, Heatmap, HeatmapScope, LatLng, LocationContext, LocationResult, MessageInput,
  MessagePreview, MessageTemplate, MessageTemplateInput, PublishEligibility, ServiceArea, ServiceAreaInput, WhatsAppCheck,
} from "./types-ops";

/** Contrato: docs/API_ADMIN_MESSAGES_GEO.md (2026-11-17). */

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Admin › Utilizadores: dar/retirar papel de admin. 409 last_admin · self_demotion · account_suspended. */
export const adminRoleApi = {
  setAdmin: (userId: string, admin: boolean) => request<AdminUserSummary>(`/admin/users/${userId}/role`, json("PATCH", { admin })),
};

/** Admin › Mensagens: modelos, pré-visualização, envio e histórico. */
export const adminMessageApi = {
  templates: () => request<MessageTemplate[]>("/admin/messages/templates"),
  createTemplate: (b: MessageTemplateInput) => request<MessageTemplate>("/admin/messages/templates", json("POST", b)),
  updateTemplate: (id: string, b: MessageTemplateInput) => request<MessageTemplate>(`/admin/messages/templates/${id}`, json("PUT", b)),
  // predefinidos: 409 predefined_template
  deleteTemplate: (id: string) => request<void>(`/admin/messages/templates/${id}`, { method: "DELETE" }),
  whatsappCheck: (phone: string) => request<WhatsAppCheck>(`/admin/messages/whatsapp-check?${new URLSearchParams({ phone })}`),
  preview: (b: MessageInput) => request<MessagePreview>("/admin/messages/preview", json("POST", b)),
  // 202: o envio sai em segundo plano; os estados aparecem no detalhe
  send: (b: MessageInput) => request<{ id: string; recipients: number; reachable: number }>("/admin/messages", json("POST", b)),
  list: (page = 0) => request<Page<AdminMessageSummary>>(`/admin/messages?page=${page}`),
  get: (id: string) => request<AdminMessageDetail>(`/admin/messages/${id}`),
};

/** Zonas de serviço (piloto: Luanda). Sem delete: desativar. */
export const serviceAreaApi = {
  active: () => request<{ id: string; province: string; city: string; active: boolean }[]>("/service-areas"),
  list: () => request<ServiceArea[]>("/admin/service-areas"),
  create: (b: ServiceAreaInput) => request<ServiceArea>("/admin/service-areas", json("POST", b)),
  update: (id: string, b: ServiceAreaInput) => request<ServiceArea>(`/admin/service-areas/${id}`, json("PUT", b)),
};

/** Localização da pessoa autenticada (arredondada a 2 casas aqui e no servidor). */
export const locationApi = {
  report: (b: LatLng & { accuracyM?: number; context: LocationContext }) => request<LocationResult>("/me/location", json("POST", b)),
  publishEligibility: (loc?: LatLng) =>
    request<PublishEligibility>(`/me/publish-eligibility${loc ? `?${new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng) })}` : ""}`),
};

/** Admin › Mapa: contagens agregadas por célula (~5 km), mínimo 3 por célula. */
export const heatmapApi = {
  get: (scope: HeatmapScope) => request<Heatmap>(`/admin/metrics/heatmap?scope=${scope}`),
};
