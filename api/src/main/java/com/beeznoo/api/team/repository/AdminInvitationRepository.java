package com.beeznoo.api.team.repository;

import com.beeznoo.api.team.entity.AdminInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface AdminInvitationRepository extends JpaRepository<AdminInvitation, UUID> {

    // Bloqueia a linha: dois "aceitar" ao mesmo tempo com o mesmo token não dão dois acessos
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM AdminInvitation i WHERE i.tokenHash = :tokenHash")
    Optional<AdminInvitation> findByTokenHashForUpdate(String tokenHash);

    Optional<AdminInvitation> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM AdminInvitation i WHERE i.id = :id")
    Optional<AdminInvitation> findByIdForUpdate(UUID id);

    // Convite pendente para a mesma pessoa (conta ou email)
    @Query("""
            SELECT COUNT(i) > 0 FROM AdminInvitation i
            WHERE i.acceptedAt IS NULL AND i.revokedAt IS NULL AND i.expiresAt > :now
              AND ((:profileId IS NOT NULL AND i.profileId = :profileId) OR (:email IS NOT NULL AND i.email = :email))
            """)
    boolean existsPendingFor(UUID profileId, String email, OffsetDateTime now);

    Page<AdminInvitation> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
