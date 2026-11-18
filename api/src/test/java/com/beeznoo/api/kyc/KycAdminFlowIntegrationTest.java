package com.beeznoo.api.kyc;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.common.storage.TestImages;
import com.beeznoo.api.kyc.repository.KycDocumentRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fluxo completo por HTTP: a pessoa envia BI e selfie → a equipa vê a fila → abre os documentos (URLs assinadas)
 * → decide com motivo; tudo auditado. Cobre as regras de acesso (só ADMIN ativo, papel lido da BD).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class KycAdminFlowIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923800000);

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired ProfileRepository profileRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired KycDocumentRepository documentRepository;
    @Autowired MockStorageService storage;

    private Profile user;
    private Profile admin;

    @BeforeEach
    void setup() {
        storage.clear();
        user = profile("Ana Domingos", UserRole.BOTH, "+244" + PHONE.incrementAndGet());
        admin = profile("Equipa Beeznoo", UserRole.ADMIN, "+244" + PHONE.incrementAndGet());
    }

    @Test
    void submeter_fila_detalhe_recusar_reenviar_aprovar() throws Exception {
        String kycId = submit(user);

        // documentos guardados em storage privado, uma linha por ficheiro
        assertThat(documentRepository.findByVerificationIdOrderByCreatedAtDesc(UUID.fromString(kycId))).hasSize(3);
        assertThat(storage.objects().keySet()).allSatisfy(k -> assertThat(k).startsWith("kyc/" + user.getId()));

        // fila do admin
        mvc.perform(get("/api/v1/admin/kyc?page=0&size=50").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", hasItem(kycId)))
                .andExpect(jsonPath("$.content[0].profileName").value("Ana Domingos"))
                .andExpect(jsonPath("$.content[0].status").value("PENDING"));

        // abrir: START_REVIEW + detalhe com URLs assinadas (sem storage_key)
        mvc.perform(patch("/api/v1/admin/kyc/{id}/review", kycId).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"START_REVIEW\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_REVIEW"));
        mvc.perform(get("/api/v1/admin/kyc/{id}", kycId).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documents", hasSize(3)))
                .andExpect(jsonPath("$.documents[*].signedUrl", everyItem(containsString("X-Amz-Expires=300"))))
                .andExpect(jsonPath("$.documents[*].documentType", containsInAnyOrder("BI_FRONT", "BI_BACK", "SELFIE")))
                .andExpect(jsonPath("$.documents[0].storageKey").doesNotExist());

        // recusar sem motivo → 400; com motivo → REJECTED, e a pessoa vê o motivo
        mvc.perform(patch("/api/v1/admin/kyc/{id}/review", kycId).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"REJECT\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/admin/kyc/{id}/review", kycId).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"REJECT\",\"note\":\"Foto do BI desfocada\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(get("/api/v1/kyc/me").header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectionReason").value("Foto do BI desfocada"));

        // reenvio: nova verificação na fila; aprovar
        String second = submit(user);
        assertThat(second).isNotEqualTo(kycId);
        mvc.perform(patch("/api/v1/admin/kyc/{id}/review", second).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.content[*].id", not(hasItem(second))));

        // os documentos da verificação recusada ficam guardados (retenção), não são apagados
        assertThat(documentRepository.findByVerificationIdOrderByCreatedAtDesc(UUID.fromString(kycId))).hasSize(3);

        // o que saiu da fila continua acessível à equipa: por separador e pela pessoa
        mvc.perform(get("/api/v1/admin/kyc?status=REJECTED").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", hasItem(kycId)));
        mvc.perform(get("/api/v1/admin/kyc?status=APPROVED").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.content[*].id", hasItem(second)))
                .andExpect(jsonPath("$.content[0].reviewedAt").isNotEmpty());
        mvc.perform(get("/api/v1/admin/kyc?profileId={id}", user.getId()).header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.content[*].id", containsInAnyOrder(kycId, second)));
        mvc.perform(get("/api/v1/admin/kyc/{id}", kycId).header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documents", hasSize(3)));
        mvc.perform(get("/api/v1/admin/kyc?status=QUALQUER").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());

        // auditoria: abrir, ver documentos, recusar, aprovar
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(UUID.fromString(kycId)))
                .extracting(a -> a.getAction())
                .contains(AuditAction.KYC_START_REVIEW, AuditAction.KYC_DOCUMENTS_VIEWED, AuditAction.KYC_REJECTED);
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(UUID.fromString(second)))
                .extracting(a -> a.getAction())
                .contains(AuditAction.KYC_APPROVED);
    }

    @Test
    void acesso_soAdminAtivo() throws Exception {
        String kycId = submit(user);

        mvc.perform(get("/api/v1/admin/kyc")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(user))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/kyc/{id}", kycId).header("Authorization", bearer(user))).andExpect(status().isForbidden());

        // admin suspenso perde o acesso já (o papel é confirmado na BD)
        String token = bearer(admin);
        admin.setSuspendedAt(OffsetDateTime.now());
        admin.setSuspensionReason("Teste");
        profileRepository.saveAndFlush(admin);
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", token)).andExpect(status().isUnauthorized());
    }

    @Test
    void adminNaoReveAPropriaVerificacao() throws Exception {
        String kycId = submit(admin);

        for (String action : new String[]{"START_REVIEW", "APPROVE"}) {
            mvc.perform(patch("/api/v1/admin/kyc/{id}/review", kycId).header("Authorization", bearer(admin))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"" + action + "\"}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/kyc/me").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.status").value("PENDING"));

        // outra pessoa da equipa decide, e fica auditado como sempre
        Profile colleague = profile("Outra Equipa", UserRole.ADMIN, "+244" + PHONE.incrementAndGet());
        mvc.perform(patch("/api/v1/admin/kyc/{id}/review", kycId).header("Authorization", bearer(colleague))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(auditLogRepository.findByEntityIdOrderByCreatedAtAsc(UUID.fromString(kycId)))
                .extracting(a -> a.getAction())
                .containsExactly(AuditAction.KYC_APPROVED);
    }

    @Test
    void numeroEstrangeiro_submeteEAparaceNaFila() throws Exception {
        Profile foreign = profile("João Silva", UserRole.RENTER, "+351912" + String.format("%06d", PHONE.incrementAndGet() % 1_000_000));
        String kycId = submit(foreign);
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", hasItem(kycId)));
    }

    private String submit(Profile p) throws Exception {
        var result = mvc.perform(multipart("/api/v1/kyc/submit")
                        .file(new MockMultipartFile("biFront", "biFront.jpg", "image/jpeg", TestImages.JPEG))
                        .file(new MockMultipartFile("biBack", "biBack.jpg", "image/jpeg", TestImages.JPEG))
                        .file(new MockMultipartFile("selfie", "selfie.jpg", "image/jpeg", TestImages.JPEG))
                        .param("accountType", "INDIVIDUAL")
                        .header("Authorization", bearer(p)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private Profile profile(String name, UserRole role, String phone) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone(phone).passwordHash("$2a$10$hash")
                .role(role).adminRole(role == UserRole.ADMIN ? com.beeznoo.api.profile.entity.AdminRole.SUPER_ADMIN : null).isVerified(true).build());
    }
}
