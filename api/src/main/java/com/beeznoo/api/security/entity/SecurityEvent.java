package com.beeznoo.api.security.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

// Append-only (trigger na BD). Sem telefones/emails em claro: identifierHash = SHA-256.
@Entity
@Immutable
@Table(name = "security_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SecurityEvent {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private SecurityEventType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private SecurityEventType.Severity severity;

    @Column(name = "profile_id", updatable = false)
    private UUID profileId;

    @Column(name = "identifier_hash", length = 64, updatable = false)
    private String identifierHash;

    @Column(length = 64, updatable = false)
    private String ip;

    @Column(name = "request_id", length = 64, updatable = false)
    private String requestId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> details = new HashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
