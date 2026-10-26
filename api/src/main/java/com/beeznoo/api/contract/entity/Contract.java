package com.beeznoo.api.contract.entity;

import com.beeznoo.api.booking.entity.Booking;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

// Texto, versão e hash congelados (também por trigger na BD); só renter_accepted_at muda, uma vez
@Entity
@Table(name = "contracts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contract {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, updatable = false, unique = true)
    private Booking booking;

    @Column(nullable = false, length = 20, updatable = false)
    private String version;

    @Column(nullable = false, columnDefinition = "TEXT", updatable = false)
    private String body;

    @Column(name = "body_sha256", nullable = false, length = 64, updatable = false)
    private String bodySha256;

    @Column(name = "owner_accepted_at", nullable = false, updatable = false)
    private OffsetDateTime ownerAcceptedAt;

    @Column(name = "renter_accepted_at")
    private OffsetDateTime renterAcceptedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public boolean isFullyAccepted() {
        return renterAcceptedAt != null;
    }
}
