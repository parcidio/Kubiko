package com.beeznoo.api.item.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "item_availability")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ItemAvailability {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    private Item item;

    @Column(name = "unavailable_date", nullable = false)
    private LocalDate unavailableDate;

    @Column(length = 50)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void OnCreate() {
        createdAt = OffsetDateTime.now();
    }
}
