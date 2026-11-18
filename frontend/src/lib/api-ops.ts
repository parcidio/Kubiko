import { request, timeoutSignal } from "./api";
import type { Page } from "./types";
import type {
  AdminMessageDetail, AdminMessageSummary, Heatmap, HeatmapScope, LatLng, LocationContext, LocationResult, LocationStatus, MessageInput,
  MessagePreview, MessageTemplate, MessageTemplateInput, PublishEligibility, ServiceArea, ServiceAreaInput, WhatsAppCheck,
} from "./types-ops";

/** Contrato: docs/API_ADMIN_MESSAGES_GEO.md (2026-11-17). */

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

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
  active: () => request<{ id: string; province: string; city: string; active: boolean }[]>("/service-areas", { signal: timeoutSignal(8_000) }),
  list: () => request<ServiceArea[]>("/admin/service-areas"),
  create: (b: ServiceAreaInput) => request<ServiceArea>("/admin/service-areas", json("POST", b)),
  update: (id: string, b: ServiceAreaInput) => request<ServiceArea>(`/admin/service-areas/${id}`, json("PUT", b)),
};

/** Localização da pessoa autenticada (arredondada a 2 casas aqui e no servidor). */
// Todos com tempo máximo: em rede instável a app segue em frente em vez de ficar à espera (2026-11-18)
export const locationApi = {
  report: (b: LatLng & { accuracyM?: number; context: LocationContext }) =>
    request<LocationResult>("/me/location", { ...json("POST", b), signal: timeoutSignal(10_000) }),
  // consentimento e zona guardados na conta (sem coordenadas): não voltar a perguntar noutro dispositivo
  status: () => request<LocationStatus>("/me/location", { signal: timeoutSignal(8_000) }),
  publishEligibility: (loc?: LatLng) =>
    request<PublishEligibility>(`/me/publish-eligibility${loc ? `?${new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng) })}` : ""}`, {
      signal: timeoutSignal(8_000),
    }),
};

/** Admin › Mapa: contagens agregadas por célula (~5 km), mínimo 3 por célula. */
export const heatmapApi = {
  get: (scope: HeatmapScope) => request<Heatmap>(`/admin/metrics/heatmap?scope=${scope}`),
};
