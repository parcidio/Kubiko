package com.beeznoo.api.kyc.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

// Uma linha por ficheiro enviado; uma re-submissão acrescenta linhas, não substitui
@Entity
@Immutable
@Table(name = "kyc_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KycDocument {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kyc_id", nullable = false, updatable = false)
    private KycVerification verification;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 30, updatable = false)
    private DocumentType documentType;

    // Nunca em DTOs nem em logs — só serve para gerar a URL assinada
    @Column(name = "storage_key", nullable = false, updatable = false, columnDefinition = "TEXT")
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 50, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
