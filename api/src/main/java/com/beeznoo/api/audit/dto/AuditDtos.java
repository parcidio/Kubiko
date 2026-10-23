package com.beeznoo.api.audit.dto;

import com.beeznoo.api.audit.entity.AuditLog;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public class AuditDtos {

    public record AuditLogResponse(
            UUID id,
            UUID actorId,
            String actorName,
            String action,
            String entityType,
            UUID entityId,
            String reason,
            Map<String, Object> metadata,
            OffsetDateTime createdAt
    ) {
        public static AuditLogResponse from(AuditLog a) {
            return new AuditLogResponse(
                    a.getId(),
                    a.getActor() == null ? null : a.getActor().getId(),
                    a.getActor() == null ? "Sistema" : a.getActor().getFullName(),
                    a.getAction().name(),
                    a.getEntityType(),
                    a.getEntityId(),
                    a.getReason(),
                    a.getMetadata(),
                    a.getCreatedAt()
            );
        }
    }

    // Motivo opcional das ações de admin sem corpo próprio (confirmar pagamento, concluir)
    public record AdminActionRequest(
            @jakarta.validation.constraints.Size(max = 1000) String reason
    ) {}
}
