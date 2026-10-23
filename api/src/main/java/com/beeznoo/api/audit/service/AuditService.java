package com.beeznoo.api.audit.service;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.entity.AuditLog;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Auditoria de ações sensíveis (CLAUDE.md §6). Grava na transação da ação: se a ação fizer rollback,
 * o registo também desaparece — nunca fica um registo de algo que não aconteceu.
 * metadata: só ids, estados e montantes. Nunca BI, NIF, referências de pagamento nem storage keys.
 */
@Service
@Transactional
public class AuditService {

    public static final String BOOKING = "BOOKING";
    public static final String KYC = "KYC";
    public static final String ACCOUNT = "ACCOUNT";
    public static final String INCIDENT = "INCIDENT";
    public static final String ITEM = "ITEM";

    private final AuditLogRepository auditLogRepository;
    private final ProfileRepository profileRepository;

    public AuditService(AuditLogRepository auditLogRepository, ProfileRepository profileRepository) {
        this.auditLogRepository = auditLogRepository;
        this.profileRepository = profileRepository;
    }

    // actorId null = sistema
    public void record(UUID actorId, AuditAction action, String entityType, UUID entityId, String reason,
                       Map<String, Object> metadata) {
        auditLogRepository.save(AuditLog.builder()
                .actor(actorId == null ? null : profileRepository.getReferenceById(actorId))
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .reason(reason == null || reason.isBlank() ? null : reason.strip())
                .metadata(metadata == null ? Map.of() : metadata)
                .build());
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(String entityType, UUID entityId, Pageable pageable) {
        Page<AuditLog> page = entityType != null && entityId != null
                ? auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId, pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return page.map(AuditLogResponse::from);
    }
}
