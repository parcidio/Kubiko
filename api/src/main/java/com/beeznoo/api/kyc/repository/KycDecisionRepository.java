package com.beeznoo.api.kyc.repository;

import com.beeznoo.api.kyc.entity.KycDecision;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface KycDecisionRepository extends JpaRepository<KycDecision, UUID> {

    @EntityGraph(attributePaths = "actor")
    List<KycDecision> findByVerificationIdOrderByCreatedAtAsc(UUID kycId);
}
