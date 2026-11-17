package com.beeznoo.api.message.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Modelo de mensagem (V26). Predefinidos vêm da migração e não se apagam. */
@Entity
@Table(name = "message_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageTemplate {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "key", updatable = false)
    private String key;

    @Column(nullable = false, length = 80)
    private String name;

    // null = qualquer canal
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private MessageChannel channel;

    @Column(length = 150)
    private String subject;

    @Column(nullable = false)
    private String body;

    @Column(nullable = false, updatable = false)
    private boolean predefined;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
