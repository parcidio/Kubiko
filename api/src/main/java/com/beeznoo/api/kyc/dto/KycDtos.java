package com.beeznoo.api.kyc.dto;

import com.beeznoo.api.kyc.entity.KycAction;
import com.beeznoo.api.kyc.entity.KycDecision;
import com.beeznoo.api.kyc.entity.KycVerification;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

// Nenhum DTO expõe a storage_key — os documentos só saem como URL assinada de curta duração
public class KycDtos {

    // Campos todos a null quando o utilizador ainda não submeteu nenhuma verificação
    public record KycStatusResponse(
            UUID id,
            String status,
            String accountType,
            OffsetDateTime submittedAt,
            OffsetDateTime reviewedAt,
            String rejectionReason,
            String infoRequestNote
    ) {
        public static KycStatusResponse none() {
            return new KycStatusResponse(null, null, null, null, null, null, null);
        }

        public static KycStatusResponse from(KycVerification k) {
            return new KycStatusResponse(
                    k.getId(),
                    k.getStatus().name(),
                    k.getAccountType().name(),
                    k.getSubmittedAt(),
                    k.getReviewedAt(),
                    k.getRejectionReason(),
                    k.getInfoRequestNote()
            );
        }
    }

    // Linha da fila do admin
    public record KycQueueItem(
            UUID id,
            UUID profileId,
            String profileName,
            String accountType,
            String status,
            OffsetDateTime submittedAt
    ) {
        public static KycQueueItem from(KycVerification k) {
            return new KycQueueItem(
                    k.getId(),
                    k.getProfile().getId(),
                    k.getProfile().getFullName(),
                    k.getAccountType().name(),
                    k.getStatus().name(),
                    k.getSubmittedAt()
            );
        }
    }

    public record DocumentResponse(
            UUID id,
            String documentType,
            String contentType,
            String signedUrl,
            OffsetDateTime expiresAt,
            OffsetDateTime uploadedAt
    ) {}

    public record DecisionResponse(
            UUID id,
            String action,
            UUID actorId,
            String actorName,
            String note,
            OffsetDateTime createdAt
    ) {
        public static DecisionResponse from(KycDecision d) {
            return new DecisionResponse(
                    d.getId(),
                    d.getAction().name(),
                    d.getActor().getId(),
                    d.getActor().getFullName(),
                    d.getNote(),
                    d.getCreatedAt()
            );
        }
    }

    public record KycDetailResponse(
            KycStatusResponse verification,
            UUID profileId,
            String profileName,
            List<DocumentResponse> documents,
            List<DecisionResponse> decisions
    ) {}

    // note obrigatória em REJECT e REQUEST_INFO (validado no serviço)
    public record ReviewRequest(
            @NotNull KycAction action,
            @Size(max = 1000) String note
    ) {}
}
