package com.beeznoo.api.item.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "item_photos")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ItemPhoto {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    // URL externa antiga; as fotos novas usam storageKey (nunca exposta — sai como URL assinada)
    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "storage_key", updatable = false, columnDefinition = "TEXT")
    private String storageKey;

    @Column(name = "content_type", length = 50, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", updatable = false)
    private Long sizeBytes;

    @Column(nullable = false)
    @Builder.Default
    private int position = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void OnCreate() {
        createdAt = OffsetDateTime.now();
    }
}
