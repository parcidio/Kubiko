package com.beeznoo.api.kyc.repository;

import com.beeznoo.api.kyc.entity.KycDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface KycDocumentRepository extends JpaRepository<KycDocument, UUID> {

    List<KycDocument> findByVerificationIdOrderByCreatedAtDesc(UUID kycId);
}
