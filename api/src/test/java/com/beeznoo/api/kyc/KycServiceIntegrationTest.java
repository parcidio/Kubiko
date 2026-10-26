package com.beeznoo.api.kyc;

import com.beeznoo.api.booking.dto.BookingDtos.CreateBookingRequest;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.item.repository.CategoryRepository;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.kyc.dto.KycDtos.*;
import com.beeznoo.api.kyc.entity.DocumentType;
import com.beeznoo.api.kyc.entity.KycAction;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.repository.KycDecisionRepository;
import com.beeznoo.api.kyc.repository.KycDocumentRepository;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Testcontainers
@Transactional
class KycServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @TestConfiguration
    static class StorageConfig {
        @Bean
        @Primary
        MockStorageService mockStorageService() {
            return new MockStorageService();
        }
    }

    // Assinaturas mínimas — o KycService valida o tipo pelos primeiros bytes
    private static final byte[] JPEG = com.beeznoo.api.common.storage.TestImages.JPEG;
    private static final byte[] PDF = "%PDF-1.7\n".getBytes();

    private static final AtomicInteger PHONE = new AtomicInteger(923300000);

    @Autowired KycService kycService;
    @Autowired com.beeznoo.api.audit.repository.AuditLogRepository auditLogRepository;
    @Autowired BookingService bookingService;
    @Autowired MockStorageService storage;
    @Autowired KycVerificationRepository verificationRepository;
    @Autowired KycDocumentRepository documentRepository;
    @Autowired KycDecisionRepository decisionRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired ItemRepository itemRepository;
    @Autowired CategoryRepository categoryRepository;

    private Profile user;
    private Profile admin;

    @BeforeEach
    void setup() {
        storage.clear();
        user = profile("Ana Domingos", UserRole.BOTH);
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
    }

    @Test
    void submit_individualComDocumentosValidos_criaVerificacaoPending() {
        KycStatusResponse res = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        assertThat(res.status()).isEqualTo("PENDING");
        assertThat(res.submittedAt()).isNotNull();
        assertThat(documentRepository.findByVerificationIdOrderByCreatedAtDesc(res.id())).hasSize(3);
        // só a storage_key fica na BD, no padrão kyc/{profileId}/{kycId}/{tipo}_{uuid}.{ext}
        assertThat(storage.objects().keySet())
                .hasSize(3)
                .allMatch(k -> k.matches("kyc/" + user.getId() + "/" + res.id() + "/(BI_FRONT|BI_BACK|SELFIE)_[0-9a-f-]{36}\\.jpg"));
        assertThat(kycService.isVerified(user.getId())).isFalse();
    }

    @Test
    void submit_semBiFrente_lancaIllegalArgument() {
        Map<DocumentType, MultipartFile> files = individualFiles();
        files.remove(DocumentType.BI_FRONT);

        assertThatThrownBy(() -> kycService.submit(user.getId(), AccountType.INDIVIDUAL, files))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BI_FRONT");
        assertThat(storage.objects()).isEmpty();
    }

    @Test
    void submit_ficheiroQueNaoEImagemNemPdf_lancaIllegalArgument() {
        Map<DocumentType, MultipartFile> files = individualFiles();
        // extensão e Content-Type mentem; o conteúdo não
        files.put(DocumentType.SELFIE, new MockMultipartFile("selfie", "selfie.jpg", "image/jpeg", "<html>".getBytes()));

        assertThatThrownBy(() -> kycService.submit(user.getId(), AccountType.INDIVIDUAL, files))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG, PNG ou PDF");
    }

    @Test
    void submit_business_exigeNifEDocumentoDaEmpresa() {
        Map<DocumentType, MultipartFile> files = new EnumMap<>(DocumentType.class);
        files.put(DocumentType.NIF_DOCUMENT, file("nifDocument", PDF));
        files.put(DocumentType.BUSINESS_DOCUMENT, file("businessDocument", PDF));

        KycStatusResponse res = kycService.submit(user.getId(), AccountType.BUSINESS, files);

        assertThat(res.accountType()).isEqualTo("BUSINESS");
        assertThat(profileRepository.findById(user.getId()).orElseThrow().getAccountType()).isEqualTo(AccountType.BUSINESS);
    }

    @Test
    void submit_comVerificacaoPendente_lancaIllegalState() {
        kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        assertThatThrownBy(() -> kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void submit_depoisDeRejeitada_criaNovaVerificacaoPending() {
        UUID first = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();
        kycService.review(admin.getId(), first, new ReviewRequest(KycAction.REJECT, "BI ilegível"));

        KycStatusResponse second = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        assertThat(second.id()).isNotEqualTo(first);
        assertThat(second.status()).isEqualTo("PENDING");
        assertThat(verificationRepository.findById(first).orElseThrow().getStatus()).isEqualTo(KycStatus.REJECTED);
    }

    @Test
    void review_aprovar_pessoaFicaVerificada() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();

        KycStatusResponse res = kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.APPROVE, null));

        assertThat(res.status()).isEqualTo("APPROVED");
        assertThat(res.reviewedAt()).isNotNull();
        assertThat(kycService.isVerified(user.getId())).isTrue();
        // telefone e identidade são coisas diferentes
        assertThat(profileRepository.findById(user.getId()).orElseThrow().isVerified()).isTrue();
    }

    @Test
    void review_rejeitarComMotivo_guardaMotivoEHistorico() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();

        kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.START_REVIEW, null));
        KycStatusResponse res = kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.REJECT, "Selfie não corresponde ao BI"));

        assertThat(res.status()).isEqualTo("REJECTED");
        assertThat(res.rejectionReason()).isEqualTo("Selfie não corresponde ao BI");
        assertThat(decisionRepository.findByVerificationIdOrderByCreatedAtAsc(kycId))
                .extracting(d -> d.getAction(), d -> d.getActor().getId())
                .containsExactly(tuple(KycAction.START_REVIEW, admin.getId()), tuple(KycAction.REJECT, admin.getId()));
        assertThat(kycService.isVerified(user.getId())).isFalse();
    }

    @Test
    void review_rejeitarSemMotivo_lancaIllegalArgument() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();

        assertThatThrownBy(() -> kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.REJECT, "  ")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void review_jaDecidida_lancaIllegalState() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();
        kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.APPROVE, null));

        assertThatThrownBy(() -> kycService.review(admin.getId(), kycId, new ReviewRequest(KycAction.REJECT, "engano")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void pedirInformacao_eResubmeter_voltaAPendingNaMesmaVerificacao() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();

        KycStatusResponse asked = kycService.review(admin.getId(), kycId,
                new ReviewRequest(KycAction.REQUEST_INFO, "Envia o verso do BI com mais luz"));
        assertThat(asked.status()).isEqualTo("INFO_REQUESTED");
        assertThat(kycService.getMyStatus(user.getId()).infoRequestNote()).isEqualTo("Envia o verso do BI com mais luz");

        KycStatusResponse resubmitted = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles());

        assertThat(resubmitted.id()).isEqualTo(kycId);
        assertThat(resubmitted.status()).isEqualTo("PENDING");
        assertThat(documentRepository.findByVerificationIdOrderByCreatedAtDesc(kycId)).hasSize(6);
        assertThat(decisionRepository.findByVerificationIdOrderByCreatedAtAsc(kycId))
                .extracting(d -> d.getAction())
                .containsExactly(KycAction.REQUEST_INFO, KycAction.RESUBMIT);
    }

    @Test
    void getDetail_devolveUrlsAssinadasSemStorageKeyNoDto() {
        UUID kycId = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();

        KycDetailResponse detail = kycService.getDetail(admin.getId(), kycId);
        // ver documentos de identidade fica na auditoria
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(kycId))
                .extracting(a -> a.getAction())
                .contains(com.beeznoo.api.audit.entity.AuditAction.KYC_DOCUMENTS_VIEWED);

        assertThat(detail.profileName()).isEqualTo("Ana Domingos");
        assertThat(detail.documents()).hasSize(3).allSatisfy(d -> {
            assertThat(d.signedUrl()).contains("X-Amz-Expires=300");
            assertThat(d.expiresAt()).isNotNull();
        });
        assertThat(DocumentResponse.class.getRecordComponents())
                .extracting(c -> c.getName())
                .doesNotContain("storageKey");
    }

    @Test
    void listPending_soMostraPendentesEEmAnalise() {
        UUID pending = kycService.submit(user.getId(), AccountType.INDIVIDUAL, individualFiles()).id();
        Profile other = profile("Mauro Fernandes", UserRole.RENTER);
        UUID approved = kycService.submit(other.getId(), AccountType.INDIVIDUAL, individualFiles()).id();
        kycService.review(admin.getId(), approved, new ReviewRequest(KycAction.APPROVE, null));

        assertThat(kycService.listPending(org.springframework.data.domain.Pageable.unpaged()))
                .extracting(KycQueueItem::id)
                .contains(pending)
                .doesNotContain(approved);
    }

    @Test
    void naoVerificadoTentaReservar_lancaAccessDenied() {
        Profile owner = profile("Edson Manuel", UserRole.OWNER);
        Category category = categoryRepository.findBySlug("fotografia")
                .orElseGet(() -> categoryRepository.save(Category.builder().name("Fotografia").slug("fotografia").build()));
        Item item = itemRepository.save(Item.builder()
                .owner(owner)
                .category(category)
                .title("Sony A7 III")
                .condition(ItemCondition.LIKE_NEW)
                .pricePerDay(new BigDecimal("5000.00"))
                .depositAmount(new BigDecimal("20000.00"))
                .build());
        CreateBookingRequest request = new CreateBookingRequest(
                item.getId(), LocalDate.now().plusDays(5), LocalDate.now().plusDays(8), null);

        assertThatThrownBy(() -> bookingService.create(user.getId(), request))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Verifica a tua identidade");
    }

    private Map<DocumentType, MultipartFile> individualFiles() {
        Map<DocumentType, MultipartFile> files = new EnumMap<>(DocumentType.class);
        files.put(DocumentType.BI_FRONT, file("biFront", JPEG));
        files.put(DocumentType.BI_BACK, file("biBack", JPEG));
        files.put(DocumentType.SELFIE, file("selfie", JPEG));
        return files;
    }

    private static MockMultipartFile file(String name, byte[] content) {
        return new MockMultipartFile(name, name + ".bin", "application/octet-stream", content);
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.save(Profile.builder()
                .fullName(name)
                .phone("+244" + PHONE.incrementAndGet())
                .passwordHash("$2a$10$hash")
                .role(role)
                .isVerified(true)
                .build());
    }
}
