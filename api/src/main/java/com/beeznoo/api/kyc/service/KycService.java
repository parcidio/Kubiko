package com.beeznoo.api.kyc.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.common.storage.StorageTransactions;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.common.storage.UploadedFiles.ValidFile;
import com.beeznoo.api.kyc.dto.KycDtos.*;
import com.beeznoo.api.kyc.entity.*;
import com.beeznoo.api.kyc.repository.KycDecisionRepository;
import com.beeznoo.api.kyc.repository.KycDocumentRepository;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Verificação de identidade manual. Ver claude/decisoes-produto.md (2026-10-23).
 * Nos logs só entram ids — nunca nomes de ficheiros, storage keys, números de BI ou NIF (CLAUDE.md §6).
 */
@Slf4j
@Service
@Transactional
public class KycService {

    static final Duration DOCUMENT_URL_TTL = Duration.ofMinutes(5);

    private static final Map<AccountType, Set<DocumentType>> REQUIRED = Map.of(
            AccountType.INDIVIDUAL, EnumSet.of(DocumentType.BI_FRONT, DocumentType.BI_BACK, DocumentType.SELFIE),
            AccountType.BUSINESS, EnumSet.of(DocumentType.NIF_DOCUMENT, DocumentType.BUSINESS_DOCUMENT)
    );

    private static final List<KycStatus> QUEUE = List.of(KycStatus.PENDING, KycStatus.IN_REVIEW);

    private final KycVerificationRepository verificationRepository;
    private final KycDocumentRepository documentRepository;
    private final KycDecisionRepository decisionRepository;
    private final ProfileRepository profileRepository;
    private final StorageService storageService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public KycService(KycVerificationRepository verificationRepository, KycDocumentRepository documentRepository,
                      KycDecisionRepository decisionRepository, ProfileRepository profileRepository,
                      StorageService storageService, NotificationService notificationService,
                      AuditService auditService) {
        this.verificationRepository = verificationRepository;
        this.documentRepository = documentRepository;
        this.decisionRepository = decisionRepository;
        this.profileRepository = profileRepository;
        this.storageService = storageService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    // Primeira submissão, nova depois de REJECTED, ou re-submissão na mesma verificação depois de INFO_REQUESTED
    public KycStatusResponse submit(UUID profileId, AccountType accountType, Map<DocumentType, MultipartFile> files) {
        if (accountType == null) throw new IllegalArgumentException("Indica o tipo de conta");
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));

        Optional<KycVerification> latest = verificationRepository.findFirstByProfileIdOrderByCreatedAtDesc(profileId);
        latest.ifPresent(KycService::assertCanSubmit);

        // valida tudo antes de enviar qualquer ficheiro
        Map<DocumentType, ValidFile> valid = validateFiles(accountType, files);

        OffsetDateTime now = OffsetDateTime.now();
        KycVerification verification;
        if (latest.isPresent() && latest.get().getStatus() == KycStatus.INFO_REQUESTED) {
            verification = latest.get();
            verification.setStatus(KycStatus.PENDING);
            verification.setAccountType(accountType);
            verification.setSubmittedAt(now);
            verification.setInfoRequestNote(null); // o pedido fica no histórico (kyc_decisions)
            recordDecision(verification, profile, KycAction.RESUBMIT, null);
        } else {
            verification = verificationRepository.save(KycVerification.builder()
                    .profile(profile)
                    .accountType(accountType)
                    .submittedAt(now)
                    .build());
        }

        String folder = "kyc/" + profileId + "/" + verification.getId();
        List<String> uploaded = StorageTransactions.deleteOnRollback(storageService);
        valid.forEach((type, file) -> {
            String filename = type.name() + "_" + UUID.randomUUID() + "." + file.extension();
            String key = storageService.upload(folder, filename, file.content(), file.contentType());
            uploaded.add(key);
            documentRepository.save(KycDocument.builder()
                    .verification(verification)
                    .documentType(type)
                    .storageKey(key)
                    .contentType(file.contentType())
                    .sizeBytes(file.content().length)
                    .build());
        });

        profile.setAccountType(accountType);
        notificationService.kycSubmitted(verification);
        log.info("KYC {} submetido ({} documentos)", verification.getId(), valid.size());
        return KycStatusResponse.from(verification);
    }

    @Transactional(readOnly = true)
    public KycStatusResponse getMyStatus(UUID profileId) {
        return verificationRepository.findFirstByProfileIdOrderByCreatedAtDesc(profileId)
                .map(KycStatusResponse::from)
                .orElseGet(KycStatusResponse::none);
    }

    @Transactional(readOnly = true)
    public Page<KycQueueItem> listPending(Pageable pageable) {
        return verificationRepository.findByStatusInOrderBySubmittedAtAsc(QUEUE, pageable).map(KycQueueItem::from);
    }

    // Admin: documentos como URL assinada de 5 minutos + histórico de decisões.
    // Não é readOnly: cada leitura dos documentos de identidade fica na auditoria (quem viu o BI de quem).
    @Transactional
    public KycDetailResponse getDetail(UUID adminId, UUID kycId) {
        KycVerification verification = findVerification(kycId);
        auditService.record(adminId, AuditAction.KYC_DOCUMENTS_VIEWED, AuditService.KYC, kycId, null,
                Map.of("profileId", verification.getProfile().getId().toString()));
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(DOCUMENT_URL_TTL);

        List<DocumentResponse> documents = documentRepository.findByVerificationIdOrderByCreatedAtDesc(kycId).stream()
                .map(d -> new DocumentResponse(
                        d.getId(),
                        d.getDocumentType().name(),
                        d.getContentType(),
                        storageService.generateSignedUrl(d.getStorageKey(), DOCUMENT_URL_TTL),
                        expiresAt,
                        d.getCreatedAt()))
                .toList();
        List<DecisionResponse> decisions = decisionRepository.findByVerificationIdOrderByCreatedAtAsc(kycId).stream()
                .map(DecisionResponse::from)
                .toList();

        Profile profile = verification.getProfile();
        return new KycDetailResponse(KycStatusResponse.from(verification), profile.getId(), profile.getFullName(),
                documents, decisions);
    }

    public KycStatusResponse review(UUID adminId, UUID kycId, ReviewRequest request) {
        Profile admin = profileRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
        KycVerification verification = verificationRepository.findByIdForUpdate(kycId)
                .orElseThrow(() -> new IllegalArgumentException("Verificação não encontrada"));

        KycAction action = request.action();
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        if ((action == KycAction.REJECT || action == KycAction.REQUEST_INFO) && note == null) {
            throw new IllegalArgumentException("Indica o motivo");
        }

        switch (action) {
            case START_REVIEW -> {
                requireStatus(verification, KycStatus.PENDING);
                verification.setStatus(KycStatus.IN_REVIEW);
            }
            case APPROVE -> close(verification, admin, KycStatus.APPROVED);
            case REJECT -> {
                close(verification, admin, KycStatus.REJECTED);
                verification.setRejectionReason(note);
            }
            case REQUEST_INFO -> {
                close(verification, admin, KycStatus.INFO_REQUESTED);
                verification.setInfoRequestNote(note);
            }
            case RESUBMIT -> throw new IllegalArgumentException("Re-submeter é feito pelo utilizador, com novos documentos");
        }

        recordDecision(verification, admin, action, note);
        auditService.record(adminId, switch (action) {
            case START_REVIEW -> AuditAction.KYC_START_REVIEW;
            case APPROVE -> AuditAction.KYC_APPROVED;
            case REJECT -> AuditAction.KYC_REJECTED;
            default -> AuditAction.KYC_INFO_REQUESTED;
        }, AuditService.KYC, verification.getId(), note,
                Map.of("profileId", verification.getProfile().getId().toString(), "status", verification.getStatus().name()));
        Profile subject = verification.getProfile();
        switch (action) {
            case APPROVE -> notificationService.kycApproved(subject);
            case REJECT -> notificationService.kycRejected(subject, note);
            case REQUEST_INFO -> notificationService.kycInfoRequested(subject, note);
            default -> { /* START_REVIEW: sem aviso */ }
        }
        log.info("KYC {} → {} por {}", verification.getId(), verification.getStatus(), adminId);
        return KycStatusResponse.from(verification);
    }

    // Gate de publicar equipamento e pedir reserva (SPEC §7)
    @Transactional(readOnly = true)
    public boolean isVerified(UUID profileId) {
        // APPROVED impede novas submissões, por isso é sempre a mais recente
        return verificationRepository.existsByProfileIdAndStatus(profileId, KycStatus.APPROVED);
    }

    private void close(KycVerification verification, Profile admin, KycStatus status) {
        if (!verification.isAwaitingReview()) {
            throw new IllegalStateException("Esta verificação já foi decidida");
        }
        verification.setStatus(status);
        verification.setReviewedAt(OffsetDateTime.now());
        verification.setReviewedBy(admin);
    }

    private void recordDecision(KycVerification verification, Profile actor, KycAction action, String note) {
        decisionRepository.save(KycDecision.builder()
                .verification(verification)
                .actor(actor)
                .action(action)
                .note(note)
                .build());
    }

    private static void assertCanSubmit(KycVerification latest) {
        switch (latest.getStatus()) {
            case APPROVED -> throw new IllegalStateException("A tua identidade já está verificada");
            case PENDING, IN_REVIEW -> throw new IllegalStateException("Já tens uma verificação em análise");
            case REJECTED, INFO_REQUESTED -> { /* pode submeter */ }
        }
    }

    private static void requireStatus(KycVerification verification, KycStatus expected) {
        if (verification.getStatus() != expected) {
            throw new IllegalStateException("A verificação não está " + expected);
        }
    }

    private Map<DocumentType, ValidFile> validateFiles(AccountType accountType, Map<DocumentType, MultipartFile> files) {
        Set<DocumentType> required = REQUIRED.get(accountType);
        Map<DocumentType, MultipartFile> sent = new EnumMap<>(DocumentType.class);
        files.forEach((type, file) -> {
            if (file != null && !file.isEmpty()) sent.put(type, file);
        });

        for (DocumentType type : required) {
            if (!sent.containsKey(type)) throw new IllegalArgumentException("Falta o documento " + type);
        }
        for (DocumentType type : sent.keySet()) {
            if (!required.contains(type)) {
                throw new IllegalArgumentException("O documento " + type + " não se aplica a uma conta " + accountType);
            }
        }

        Map<DocumentType, ValidFile> valid = new EnumMap<>(DocumentType.class);
        sent.forEach((type, file) ->
                valid.put(type, UploadedFiles.validate(file, "O documento " + type, UploadedFiles.IMAGES_AND_PDF)));
        return valid;
    }

    private KycVerification findVerification(UUID kycId) {
        return verificationRepository.findById(kycId)
                .orElseThrow(() -> new IllegalArgumentException("Verificação não encontrada"));
    }
}
