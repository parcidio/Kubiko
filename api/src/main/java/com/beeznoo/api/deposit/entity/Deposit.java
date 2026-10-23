package com.beeznoo.api.deposit.entity;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.profile.entity.Profile;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "deposits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Deposit {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false, updatable = false, unique = true)
    private Booking booking;

    @Column(nullable = false, precision = 12, scale = 2, updatable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DepositStatus status = DepositStatus.HELD;

    @Column(name = "withheld_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal withheldAmount = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private Profile decidedBy;

    @Column(name = "held_at", nullable = false, updatable = false)
    private OffsetDateTime heldAt;

    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
