package com.beeznoo.api.security.dto;

import com.beeznoo.api.security.entity.SecurityEvent;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public class SecurityEventDtos {

    public record SecurityEventResponse(
            UUID id,
            String type,
            String severity,
            UUID profileId,
            String ip,
            String requestId,
            Map<String, Object> details,
            OffsetDateTime createdAt
    ) {
        public static SecurityEventResponse from(SecurityEvent e) {
            return new SecurityEventResponse(e.getId(), e.getType().name(), e.getSeverity().name(), e.getProfileId(),
                    e.getIp(), e.getRequestId(), e.getDetails(), e.getCreatedAt());
        }
    }
}
