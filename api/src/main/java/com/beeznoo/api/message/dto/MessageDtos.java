package com.beeznoo.api.message.dto;

import com.beeznoo.api.message.entity.DeliveryStatus;
import com.beeznoo.api.message.entity.MessageChannel;
import com.beeznoo.api.message.entity.MessageTemplate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Admin › Mensagens — contrato em docs/API_ADMIN_MESSAGES_GEO.md (2026-11-17). */
public final class MessageDtos {

    private MessageDtos() {}

    // ---- Modelos ----

    public record TemplateResponse(UUID id, String key, String name, MessageChannel channel, String subject,
                                   String body, boolean predefined, OffsetDateTime updatedAt) {
        public static TemplateResponse from(MessageTemplate t) {
            return new TemplateResponse(t.getId(), t.getKey(), t.getName(), t.getChannel(), t.getSubject(),
                    t.getBody(), t.isPredefined(), t.getUpdatedAt());
        }
    }

    /** channel null = serve para qualquer canal. */
    public record TemplateRequest(
            @NotBlank @Size(max = 80) String name,
            @Size(max = 150) String subject,
            @NotBlank @Size(max = 1000) String body,
            MessageChannel channel
    ) {}

    // ---- Verificar WhatsApp ----

    /** hasWhatsApp null = gateway indisponível ou sem resposta clara. international = fora de +244. */
    public record WhatsAppCheckResponse(String phone, Boolean hasWhatsApp, boolean international) {}

    // ---- Envio ----

    public enum AudienceType { USERS, ALL, VERIFIED, UNVERIFIED, CITY }

    /** USERS: userIds (≤ 200). CITY: areaId (zona de serviço). Os restantes não levam mais nada. */
    public record Audience(
            @NotNull AudienceType type,
            @Size(max = 200) List<UUID> userIds,
            UUID areaId
    ) {}

    /** Sem templateId, body é obrigatório. Com templateId, body/subject (se vierem) substituem os do modelo. */
    public record SendRequest(
            @NotNull MessageChannel channel,
            @NotNull @Valid Audience audience,
            UUID templateId,
            @Size(max = 150) String subject,
            @Size(max = 1000) String body
    ) {}

    public record Sample(String subject, String body) {}

    /**
     * skipped: noPhone, noEmail, foreignSms, foreignNoWhatsapp (só se sabe no envio), suspended, unconfirmed.
     * channelAvailable: o canal está configurado neste ambiente. maxRecipients: limite deste canal por envio.
     */
    public record PreviewResponse(int recipients, int reachable, Map<String, Integer> skipped, Sample sample,
                                  boolean channelAvailable, int maxRecipients) {}

    public record SendResponse(UUID id, int recipients, int reachable) {}

    // ---- Histórico ----

    public record MessageSummary(UUID id, MessageChannel channel, String subject, String bodyPreview,
                                 String audienceLabel, int recipients, long sent, long failed, long pending,
                                 long skipped, OffsetDateTime createdAt, String createdBy) {}

    public record DeliveryResponse(UUID userId, String name, String destinationMasked, DeliveryStatus status,
                                   String error, OffsetDateTime sentAt) {}

    public record MessageDetail(UUID id, MessageChannel channel, String subject, String body, String audienceLabel,
                                int recipients, long sent, long failed, long pending, long skipped,
                                OffsetDateTime createdAt, String createdBy, OffsetDateTime finishedAt,
                                List<DeliveryResponse> deliveries) {}
}
