package com.beeznoo.api.auth.entity;

import com.beeznoo.api.profile.entity.Profile;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.OffsetDateTime;
import java.util.UUID;

// Código de uso único (60 s) entregue no redirect do Google e trocado por tokens. Só o hash fica na BD.
@Entity
@Table(name = "oauth_login_codes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OAuthLoginCode {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "code_hash", nullable = false, unique = true, length = 64, updatable = false)
    private String codeHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false, updatable = false)
    private Profile profile;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
    }

    public boolean isUsableAt(OffsetDateTime now) {
        return usedAt == null && expiresAt.isAfter(now);
    }
}
