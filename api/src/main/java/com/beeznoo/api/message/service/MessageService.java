package com.beeznoo.api.message.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.message.config.MessageProperties;
import com.beeznoo.api.message.dto.MessageDtos.*;
import com.beeznoo.api.message.entity.*;
import com.beeznoo.api.message.repository.AdminMessageRepository;
import com.beeznoo.api.message.repository.MessageDeliveryRepository;
import com.beeznoo.api.message.repository.MessageTemplateRepository;
import com.beeznoo.api.notification.email.ResendEmailSender;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin › Mensagens (decisoes-produto.md 2026-11-17): modelos, pré-visualização e envio. O envio grava a mensagem e uma
 * linha por destinatário nesta transação; o MessageDispatcher envia depois do commit, em segundo plano.
 * Nunca escreve telefones, emails nem o texto nos logs.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

    // contra um segmento enorme carregado para memória só para dar 422
    private static final int RESOLVE_HARD_LIMIT = 20_000;
    private static final String DEFAULT_SUBJECT = "Mensagem da Beeznoo";

    /** Destinatário resolvido a partir do público. */
    record Recipient(UUID id, String name, String phone, String email, boolean phoneConfirmed, boolean suspended) {}

    /** Destinatário + destino + motivo para não enviar (null = envia). */
    record Planned(Recipient recipient, String destination, String skipReason) {}

    record Content(UUID templateId, String subject, String body) {}

    private static final RowMapper<Recipient> RECIPIENT = (rs, i) -> new Recipient(
            rs.getObject("id", UUID.class), rs.getString("full_name"), rs.getString("phone"), rs.getString("email"),
            rs.getBoolean("is_verified"), rs.getBoolean("suspended"));

    private final JdbcTemplate jdbc;
    private final MessageTemplateRepository templateRepository;
    private final AdminMessageRepository messageRepository;
    private final MessageDeliveryRepository deliveryRepository;
    private final AuditService auditService;
    private final ApplicationEventPublisher events;
    private final MessageProperties props;
    private final WhatsAppOtpClient whatsApp;
    private final OmbalaSmsService sms;
    private final ResendEmailSender email;

    // ---------------------------------------------------------------- modelos

    @Transactional(readOnly = true)
    public List<TemplateResponse> templates() {
        return templateRepository.findAllByOrderByPredefinedDescNameAsc().stream().map(TemplateResponse::from).toList();
    }

    @Transactional
    public TemplateResponse createTemplate(UUID adminId, TemplateRequest request) {
        MessageTemplate t = MessageTemplate.builder()
                .name(request.name().strip())
                .subject(blankToNull(MessageText.singleLine(request.subject())))
                .body(request.body().strip())
                .channel(request.channel())
                .predefined(false)
                .createdBy(adminId)
                .build();
        return TemplateResponse.from(templateRepository.saveAndFlush(t));
    }

    @Transactional
    public TemplateResponse updateTemplate(UUID templateId, TemplateRequest request) {
        MessageTemplate t = template(templateId);
        t.setName(request.name().strip());
        t.setSubject(blankToNull(MessageText.singleLine(request.subject())));
        t.setBody(request.body().strip());
        t.setChannel(request.channel());
        return TemplateResponse.from(templateRepository.saveAndFlush(t));
    }

    @Transactional
    public void deleteTemplate(UUID templateId) {
        MessageTemplate t = template(templateId);
        if (t.isPredefined()) {
            throw ApiException.conflict("predefined_template", "Os modelos predefinidos não se apagam");
        }
        templateRepository.delete(t);
    }

    // ---------------------------------------------------------------- WhatsApp

    public WhatsAppCheckResponse whatsAppCheck(String phone) {
        return new WhatsAppCheckResponse(phone, whatsApp.hasWhatsApp(phone), !MessageText.isAngolan(phone));
    }

    // ---------------------------------------------------------------- envio

    @Transactional(readOnly = true)
    public PreviewResponse preview(SendRequest request) {
        Content content = content(request);
        List<Planned> plan = plan(request.channel(), resolve(request.audience()));
        int reachable = reachable(plan);
        Recipient first = plan.stream().filter(p -> p.skipReason() == null).map(Planned::recipient).findFirst()
                .orElse(null);
        String sampleName = first == null ? "Ana Domingos" : first.name();
        Sample sample = new Sample(
                request.channel() == MessageChannel.EMAIL ? MessageText.render(content.subject(), sampleName) : null,
                MessageText.render(content.body(), sampleName));
        return new PreviewResponse(plan.size(), reachable, skippedCounts(plan), sample,
                channelAvailable(request.channel()), limit(request.channel()));
    }

    @Transactional
    public SendResponse send(UUID adminId, SendRequest request) {
        Content content = content(request);
        if (!channelAvailable(request.channel())) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "channel_unavailable",
                    "Este canal não está configurado neste ambiente");
        }
        List<Planned> plan = plan(request.channel(), resolve(request.audience()));
        int reachable = reachable(plan);
        if (reachable == 0) {
            throw ApiException.unprocessable("no_recipients", "Ninguém deste público pode receber por este canal");
        }
        int limit = limit(request.channel());
        if (reachable > limit) {
            throw ApiException.unprocessable("too_many_recipients",
                    "Máximo de " + limit + " destinatários por envio neste canal. Escolhe um público mais pequeno.");
        }
        if (request.channel() == MessageChannel.WHATSAPP) assertWhatsAppHourlyCap(adminId, reachable);

        AdminMessage message = messageRepository.saveAndFlush(AdminMessage.builder()
                .channel(request.channel())
                .templateId(content.templateId())
                .subject(content.subject())
                .body(content.body())
                .audience(audienceJson(request.audience()))
                .audienceLabel(audienceLabel(request.audience()))
                .recipients(plan.size())
                .createdBy(adminId)
                .build());

        List<MessageDelivery> deliveries = plan.stream().map(p -> MessageDelivery.builder()
                .messageId(message.getId())
                .profileId(p.recipient().id())
                .destination(p.destination())
                .status(p.skipReason() == null ? DeliveryStatus.PENDING : DeliveryStatus.SKIPPED)
                .error(p.skipReason())
                .build()).toList();
        deliveryRepository.saveAll(deliveries);
        deliveryRepository.flush();

        auditService.record(adminId, AuditAction.MESSAGE_SENT, AuditService.MESSAGE, message.getId(), null,
                Map.of("channel", request.channel().name(), "audience", request.audience().type().name(),
                        "recipients", plan.size(), "reachable", reachable));
        // o MessageDispatcher só começa depois do commit (rollback = nada sai)
        events.publishEvent(new MessageQueued(message.getId()));
        return new SendResponse(message.getId(), plan.size(), reachable);
    }

    // ---------------------------------------------------------------- histórico

    private static final String COUNTS = """
            (SELECT count(*) FROM message_deliveries d WHERE d.message_id = m.id AND d.status = 'SENT') AS sent,
            (SELECT count(*) FROM message_deliveries d WHERE d.message_id = m.id AND d.status = 'FAILED') AS failed,
            (SELECT count(*) FROM message_deliveries d WHERE d.message_id = m.id AND d.status = 'PENDING') AS pending,
            (SELECT count(*) FROM message_deliveries d WHERE d.message_id = m.id AND d.status = 'SKIPPED') AS skipped,
            (SELECT p.full_name FROM profiles p WHERE p.id = m.created_by) AS created_by_name
            """;

    @Transactional(readOnly = true)
    public Page<MessageSummary> list(int page, int size) {
        long total = messageRepository.count();
        List<MessageSummary> rows = jdbc.query("""
                SELECT m.id, m.channel, m.subject, m.body, m.audience_label, m.recipients, m.created_at,
                """ + COUNTS + " FROM admin_messages m ORDER BY m.created_at DESC LIMIT ? OFFSET ?",
                (rs, i) -> new MessageSummary(rs.getObject("id", UUID.class),
                        MessageChannel.valueOf(rs.getString("channel")), rs.getString("subject"),
                        MessageText.preview(rs.getString("body")), rs.getString("audience_label"),
                        rs.getInt("recipients"), rs.getLong("sent"), rs.getLong("failed"), rs.getLong("pending"),
                        rs.getLong("skipped"), rs.getObject("created_at", OffsetDateTime.class),
                        rs.getString("created_by_name")),
                size, (long) page * size);
        return new PageImpl<>(rows, PageRequest.of(page, size), total);
    }

    @Transactional(readOnly = true)
    public MessageDetail detail(UUID messageId) {
        List<MessageDetail> found = jdbc.query("""
                SELECT m.id, m.channel, m.subject, m.body, m.audience_label, m.recipients, m.created_at, m.finished_at,
                """ + COUNTS + " FROM admin_messages m WHERE m.id = ?",
                (rs, i) -> new MessageDetail(rs.getObject("id", UUID.class),
                        MessageChannel.valueOf(rs.getString("channel")), rs.getString("subject"), rs.getString("body"),
                        rs.getString("audience_label"), rs.getInt("recipients"), rs.getLong("sent"),
                        rs.getLong("failed"), rs.getLong("pending"), rs.getLong("skipped"),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getString("created_by_name"),
                        rs.getObject("finished_at", OffsetDateTime.class), List.of()),
                messageId);
        if (found.isEmpty()) throw ApiException.notFound("message_not_found", "Mensagem não encontrada");
        List<DeliveryResponse> deliveries = jdbc.query("""
                SELECT d.profile_id, p.full_name, d.destination, d.status, d.error, d.sent_at
                FROM message_deliveries d JOIN profiles p ON p.id = d.profile_id
                WHERE d.message_id = ?
                ORDER BY CASE d.status WHEN 'FAILED' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'SENT' THEN 2 ELSE 3 END,
                         p.full_name
                """, (rs, i) -> new DeliveryResponse(rs.getObject("profile_id", UUID.class), rs.getString("full_name"),
                MessageText.mask(rs.getString("destination")), DeliveryStatus.valueOf(rs.getString("status")),
                rs.getString("error"), rs.getObject("sent_at", OffsetDateTime.class)), messageId);
        MessageDetail m = found.getFirst();
        return new MessageDetail(m.id(), m.channel(), m.subject(), m.body(), m.audienceLabel(), m.recipients(),
                m.sent(), m.failed(), m.pending(), m.skipped(), m.createdAt(), m.createdBy(), m.finishedAt(), deliveries);
    }

    // ---------------------------------------------------------------- regras

    boolean channelAvailable(MessageChannel channel) {
        return switch (channel) {
            case WHATSAPP -> whatsApp.configured();
            case EMAIL -> email.isEnabled();
            case SMS -> sms.configured();
        };
    }

    /**
     * WhatsApp custa dinheiro: no máximo N mensagens por admin por hora, contadas nas entregas não ignoradas
     * (PENDING, SENT ou FAILED) dos envios dele na última hora. Bloqueia os envios do admin para não haver corrida.
     */
    private void assertWhatsAppHourlyCap(UUID adminId, int reachable) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtext(?))", rs -> {}, "admin-wa-cap:" + adminId);
        Long used = jdbc.queryForObject("""
                SELECT count(*) FROM message_deliveries d JOIN admin_messages m ON m.id = d.message_id
                WHERE m.created_by = ? AND m.channel = 'WHATSAPP' AND d.status <> 'SKIPPED'
                  AND m.created_at > now() - interval '1 hour'
                """, Long.class, adminId);
        int cap = props.whatsappHourlyCap();
        if ((used == null ? 0 : used) + reachable > cap) {
            long left = Math.max(0, cap - (used == null ? 0 : used));
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "whatsapp_hourly_cap",
                    "Limite de " + cap + " mensagens de WhatsApp por hora. Podes enviar mais " + left + " agora.");
        }
    }

    private int limit(MessageChannel channel) {
        return channel == MessageChannel.WHATSAPP
                ? Math.min(props.maxWhatsappRecipients(), props.maxRecipients())
                : props.maxRecipients();
    }

    private Content content(SendRequest request) {
        MessageTemplate t = request.templateId() == null ? null : template(request.templateId());
        if (t != null && t.getChannel() != null && t.getChannel() != request.channel()) {
            throw ApiException.unprocessable("template_channel_mismatch", "Este modelo é para " + t.getChannel());
        }
        String body = blankToNull(request.body());
        if (body == null && t != null) body = t.getBody();
        if (body == null) throw new IllegalArgumentException("Escreve a mensagem ou escolhe um modelo");
        String subject = blankToNull(MessageText.singleLine(request.subject()));
        if (subject == null && t != null) subject = t.getSubject();
        if (request.channel() != MessageChannel.EMAIL) subject = null;
        else if (subject == null) subject = DEFAULT_SUBJECT;
        return new Content(t == null ? null : t.getId(), subject, body.strip());
    }

    /** Destino e motivo para não enviar, por canal. Números fora de +244 só por WhatsApp. */
    static List<Planned> plan(MessageChannel channel, List<Recipient> recipients) {
        List<Planned> out = new ArrayList<>(recipients.size());
        for (Recipient r : recipients) {
            String destination = channel == MessageChannel.EMAIL ? r.email() : r.phone();
            String skip = null;
            if (r.suspended()) skip = "suspended";
            else if (!r.phoneConfirmed()) skip = "unconfirmed";      // registo por acabar: número não confirmado
            else if (destination == null || destination.isBlank()) skip = channel == MessageChannel.EMAIL ? "no_email" : "no_phone";
            else if (channel == MessageChannel.SMS && !MessageText.isAngolan(destination)) skip = "foreign_sms";
            out.add(new Planned(r, destination, skip));
        }
        return out;
    }

    private static int reachable(List<Planned> plan) {
        return (int) plan.stream().filter(p -> p.skipReason() == null).count();
    }

    private static final Map<String, String> SKIP_KEYS = Map.of(
            "no_phone", "noPhone", "no_email", "noEmail", "foreign_sms", "foreignSms",
            "not_on_whatsapp", "foreignNoWhatsapp", "suspended", "suspended", "unconfirmed", "unconfirmed");

    private static Map<String, Integer> skippedCounts(List<Planned> plan) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String key : List.of("noPhone", "noEmail", "foreignSms", "foreignNoWhatsapp", "suspended", "unconfirmed")) {
            counts.put(key, 0);
        }
        plan.stream().filter(p -> p.skipReason() != null)
                .forEach(p -> counts.merge(SKIP_KEYS.get(p.skipReason()), 1, Integer::sum));
        return counts;
    }

    private static final String RECIPIENT_COLUMNS = """
            SELECT p.id, p.full_name, p.phone, p.email, p.is_verified, p.suspended_at IS NOT NULL AS suspended
            FROM profiles p
            """;
    private static final String APPROVED_KYC =
            "EXISTS (SELECT 1 FROM kyc_verifications k WHERE k.profile_id = p.id AND k.status = 'APPROVED')";

    List<Recipient> resolve(Audience audience) {
        String orderLimit = " ORDER BY p.created_at LIMIT " + (RESOLVE_HARD_LIMIT + 1);
        List<Recipient> rows = switch (audience.type()) {
            case USERS -> {
                List<UUID> ids = audience.userIds() == null ? List.of()
                        : audience.userIds().stream().filter(Objects::nonNull).distinct().toList();
                if (ids.isEmpty()) throw new IllegalArgumentException("Escolhe pelo menos uma pessoa");
                if (ids.size() > 200) throw new IllegalArgumentException("Máximo de 200 pessoas escolhidas à mão");
                String in = ids.stream().map(x -> "?").collect(Collectors.joining(","));
                yield jdbc.query(RECIPIENT_COLUMNS + " WHERE p.id IN (" + in + ")" + orderLimit, RECIPIENT, ids.toArray());
            }
            case ALL -> jdbc.query(RECIPIENT_COLUMNS + orderLimit, RECIPIENT);
            case VERIFIED -> jdbc.query(RECIPIENT_COLUMNS + " WHERE " + APPROVED_KYC + orderLimit, RECIPIENT);
            case UNVERIFIED -> jdbc.query(RECIPIENT_COLUMNS + " WHERE NOT " + APPROVED_KYC + orderLimit, RECIPIENT);
            case CITY -> {
                String city = areaCity(audience.areaId());
                yield jdbc.query(RECIPIENT_COLUMNS + " WHERE lower(btrim(p.city)) = lower(btrim(?))" + orderLimit,
                        RECIPIENT, city);
            }
        };
        if (rows.size() > RESOLVE_HARD_LIMIT) {
            throw ApiException.unprocessable("too_many_recipients", "Público demasiado grande. Escolhe um segmento mais pequeno.");
        }
        return rows;
    }

    /**
     * Cidade da zona de serviço (V27, service_areas). Zona inexistente → 404 area_not_found.
     * ⚑ Hoje compara com profiles.city (texto escrito pela pessoa); com a localização da V27 pode passar a raio.
     */
    private String areaCity(UUID areaId) {
        if (areaId == null) throw new IllegalArgumentException("Escolhe a zona");
        Boolean exists = jdbc.queryForObject("SELECT to_regclass('public.service_areas') IS NOT NULL", Boolean.class);
        if (!Boolean.TRUE.equals(exists)) {
            throw ApiException.unprocessable("audience_unavailable", "As zonas de serviço ainda não estão disponíveis");
        }
        List<String> city = jdbc.queryForList("SELECT city FROM service_areas WHERE id = ?", String.class, areaId);
        if (city.isEmpty()) throw ApiException.notFound("area_not_found", "Zona não encontrada");
        return city.getFirst();
    }

    private String audienceLabel(Audience audience) {
        return switch (audience.type()) {
            case USERS -> {
                int n = audience.userIds() == null ? 0 : (int) audience.userIds().stream().distinct().count();
                yield n == 1 ? "1 pessoa" : n + " pessoas";
            }
            case ALL -> "Todos";
            case VERIFIED -> "Verificados";
            case UNVERIFIED -> "Por verificar";
            case CITY -> "Cidade: " + areaCity(audience.areaId());
        };
    }

    private static Map<String, Object> audienceJson(Audience audience) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("type", audience.type().name());
        if (audience.type() == AudienceType.USERS && audience.userIds() != null) {
            json.put("userIds", audience.userIds().stream().filter(Objects::nonNull).distinct().map(UUID::toString).toList());
        }
        if (audience.type() == AudienceType.CITY) json.put("areaId", String.valueOf(audience.areaId()));
        return json;
    }

    private MessageTemplate template(UUID id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("template_not_found", "Modelo não encontrado"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    /** Publicado na transação do envio; o MessageDispatcher começa depois do commit. */
    public record MessageQueued(UUID messageId) {}
}
