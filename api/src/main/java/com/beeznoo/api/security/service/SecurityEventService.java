package com.beeznoo.api.security.service;

import com.beeznoo.api.common.security.ClientIp;
import com.beeznoo.api.common.security.RequestIdFilter;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.security.dto.SecurityEventDtos.SecurityEventResponse;
import com.beeznoo.api.security.entity.SecurityEvent;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.repository.SecurityEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Eventos de segurança (OWASP A09). Gravados numa transação PRÓPRIA: quase sempre acontecem quando a operação
 * falha (login errado, OTP bloqueado) e essa falha faz rollback. Nunca lança — registar não pode partir o pedido.
 * Eventos HIGH geram um alerta aos admins (no máximo um por tipo a cada 10 min).
 */
@Slf4j
@Service
public class SecurityEventService {

    static final Duration ALERT_COOLDOWN = Duration.ofMinutes(10);

    private final SecurityEventRepository repository;
    private final ClientIp clientIp;
    private final NotificationService notificationService;
    private final Map<SecurityEventType, Instant> lastAlert = new ConcurrentHashMap<>();

    public SecurityEventService(SecurityEventRepository repository, ClientIp clientIp,
                                NotificationService notificationService) {
        this.repository = repository;
        this.clientIp = clientIp;
        this.notificationService = notificationService;
    }

    // identifier: telefone/email (fica só o SHA-256); details: nada de dados pessoais
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(SecurityEventType type, UUID profileId, String identifier, Map<String, Object> details) {
        try {
            repository.save(SecurityEvent.builder()
                    .type(type)
                    .severity(type.severity)
                    .profileId(profileId)
                    .identifierHash(identifier == null ? null : sha256(identifier.strip().toLowerCase()))
                    .ip(currentIp())
                    .requestId(MDC.get(RequestIdFilter.MDC_KEY))
                    .details(details == null ? Map.of() : details)
                    .build());
            log.info("Evento de segurança {} ({})", type, type.severity);
            if (type.severity == SecurityEventType.Severity.HIGH && shouldAlert(type)) {
                notificationService.securityAlert(type.name());
            }
        } catch (RuntimeException e) {
            log.error("Não foi possível gravar o evento de segurança {} ({})", type, e.getClass().getSimpleName());
        }
    }

    @Transactional(readOnly = true)
    public Page<SecurityEventResponse> list(SecurityEventType.Severity severity, Pageable pageable) {
        Page<SecurityEvent> page = severity == null
                ? repository.findAllByOrderByCreatedAtDesc(pageable)
                : repository.findBySeverityOrderByCreatedAtDesc(severity, pageable);
        return page.map(SecurityEventResponse::from);
    }

    private boolean shouldAlert(SecurityEventType type) {
        Instant now = Instant.now();
        Instant previous = lastAlert.get(type);
        if (previous != null && previous.plus(ALERT_COOLDOWN).isAfter(now)) return false;
        lastAlert.put(type, now);
        return true;
    }

    private String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return clientIp.of(attrs.getRequest());
        }
        return null;
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
