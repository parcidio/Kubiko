package com.beeznoo.api.message.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/** Um envio da equipa (V26). body guarda o texto com as variáveis por substituir. */
@Entity
@Table(name = "admin_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminMessage {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    private MessageChannel channel;

    @Column(name = "template_id", updatable = false)
    private UUID templateId;

    @Column(length = 150, updatable = false)
    private String subject;

    @Column(nullable = false, updatable = false)
    private String body;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
    private Map<String, Object> audience;

    @Column(name = "audience_label", nullable = false, length = 120, updatable = false)
    private String audienceLabel;

    @Column(nullable = false, updatable = false)
    private int recipients;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
