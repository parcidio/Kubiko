package com.beeznoo.api.kyc.repository;

import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface KycVerificationRepository extends JpaRepository<KycVerification, UUID> {

    Optional<KycVerification> findFirstByProfileIdOrderByCreatedAtDesc(UUID profileId);

    boolean existsByProfileIdAndStatus(UUID profileId, KycStatus status);

    // Fila do admin: mais antiga primeiro
    @EntityGraph(attributePaths = "profile")
    Page<KycVerification> findByStatusInOrderBySubmittedAtAsc(Collection<KycStatus> statuses, Pageable pageable);

    // SELECT ... FOR UPDATE — dois admins não decidem a mesma verificação ao mesmo tempo
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT k FROM KycVerification k WHERE k.id = :id")
    Optional<KycVerification> findByIdForUpdate(UUID id);
}
