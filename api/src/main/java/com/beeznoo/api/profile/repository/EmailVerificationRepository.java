package com.beeznoo.api.profile.repository;

import com.beeznoo.api.profile.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, UUID> {

    Optional<EmailVerification> findFirstByProfileIdAndUsedAtIsNullOrderByCreatedAtDesc(UUID profileId);

    @Modifying(flushAutomatically = true)
    @Query("UPDATE EmailVerification e SET e.usedAt = CURRENT_TIMESTAMP WHERE e.profileId = :profileId AND e.usedAt IS NULL")
    void invalidateAll(UUID profileId);
}
