package com.beeznoo.api.audit.service;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.entity.AuditLog;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Locale;
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
        return list(entityType, entityId, null, null, pageable);
    }

    // A ordem é sempre a mais recente primeiro (o cliente não escolhe colunas para ordenar)
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(String entityType, UUID entityId, AuditAction action, UUID actorId,
                                       Pageable pageable) {
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        String type = entityType == null || entityType.isBlank() ? null : entityType.strip().toUpperCase(Locale.ROOT);
        return auditLogRepository.search(type, entityId, action, actorId, unsorted).map(AuditLogResponse::from);
    }
}
