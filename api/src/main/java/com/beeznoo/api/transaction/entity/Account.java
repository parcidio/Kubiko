package com.beeznoo.api.transaction.entity;

import com.beeznoo.api.profile.entity.Profile;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    public UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id", nullable = false, unique = true)
    private Profile profile;

    @Column(name = "available_balance", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal availableBalance = BigDecimal.ZERO;

    @Column(name = "held_balance", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal heldBalance = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "AOA";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, updatable = false)
    private OffsetDateTime updatedAt;


    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public void holdAmount(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor a reter tem de ser positivo");
        }
        if (availableBalance.compareTo(amount) < 0) {
            throw new IllegalStateException("Saldo disponível insuficiente para retenção");
        }
        availableBalance = availableBalance.subtract(amount);
        heldBalance = heldBalance.add(amount);
    }

    public void releaseHeld(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor a libertar tem de ser positivo");
        }
        if (heldBalance.compareTo(amount) < 0) {
            throw new IllegalStateException("Saldo retido insuficiente para libertar");
        }
        heldBalance = heldBalance.subtract(amount);
        availableBalance = availableBalance.add(amount);
    }

    public void withholdHeld(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor a reter por sinistro tem de ser positivo");
        }
        if (heldBalance.compareTo(amount) < 0) {
            throw new IllegalStateException("Saldo retido insuficiente para retenção por sinistro");
        }
        heldBalance = heldBalance.subtract(amount);
    }

    public void credit(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Valor a creditar tem de ser positivo");
        }
        availableBalance = availableBalance.add(amount);
    }
}
