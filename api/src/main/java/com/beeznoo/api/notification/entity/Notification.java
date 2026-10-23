package com.beeznoo.api.notification.entity;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.profile.entity.Profile;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

// Só mudam depois de criadas: read_at (lida) e email_* (resultado da entrega)
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false, updatable = false)
    private Profile profile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50, updatable = false)
    private NotificationType type;

    @Column(nullable = false, length = 200, updatable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT", updatable = false)
    private String body;

    @Column(name = "link_path", length = 200, updatable = false)
    private String linkPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", updatable = false)
    private Booking booking;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "email_status", nullable = false, length = 20)
    @Builder.Default
    private EmailStatus emailStatus = EmailStatus.PENDING;

    // nunca devolvido pela API
    @Column(name = "email_error", columnDefinition = "TEXT")
    private String emailError;

    @Column(name = "emailed_at")
    private OffsetDateTime emailedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
