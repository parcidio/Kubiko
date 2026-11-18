package com.beeznoo.api.team.entity;

import com.beeznoo.api.profile.entity.AdminRole;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Convite para a equipa (V29, decisoes-produto.md 2026-11-18). O token só existe em hash. */
@Entity
@Table(name = "admin_invitations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminInvitation {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    // conta convidada (null = convite por email)
    @Column(name = "profile_id", updatable = false)
    private UUID profileId;

    // em minúsculas
    @Column(updatable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_role", nullable = false, length = 20, updatable = false)
    private AdminRole adminRole;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64, updatable = false)
    private String tokenHash;

    @Column(length = 500, updatable = false)
    private String note;

    @Column(name = "invited_by", nullable = false, updatable = false)
    private UUID invitedBy;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "accepted_by")
    private UUID acceptedBy;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public InvitationStatus statusAt(OffsetDateTime now) {
        if (acceptedAt != null) return InvitationStatus.ACCEPTED;
        if (revokedAt != null) return InvitationStatus.REVOKED;
        if (!expiresAt.isAfter(now)) return InvitationStatus.EXPIRED;
        return InvitationStatus.PENDING;
    }

    public enum InvitationStatus { PENDING, ACCEPTED, REVOKED, EXPIRED }
}
