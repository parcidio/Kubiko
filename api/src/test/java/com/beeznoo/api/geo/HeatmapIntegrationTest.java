package com.beeznoo.api.geo;

import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.geo.dto.GeoDtos.Heatmap;
import com.beeznoo.api.geo.dto.GeoDtos.HeatmapScope;
import com.beeznoo.api.geo.entity.LocationContext;
import com.beeznoo.api.geo.repository.LocationEventRepository;
import com.beeznoo.api.geo.scheduler.LocationRetentionScheduler;
import com.beeznoo.api.geo.service.HeatmapService;
import com.beeznoo.api.kyc.entity.KycStatus;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.kyc.repository.KycVerificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * De ponta a ponta: a app envia POST /me/location e o Admin › Mapa devolve-o agregado (bug de 2026-11-18: pessoas
 * com localização aceite e mapa vazio). Os envios passam pelo endpoint real (autenticação, validação, limites).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class HeatmapIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final AtomicInteger PHONE = new AtomicInteger(924800000);

    // 3 pessoas na mesma célula de 5 km (sul de Luanda): centro -8.925, 13.175
    private static final double[][] SAME_CELL = {{-8.9112, 13.1801}, {-8.9203, 13.1899}, {-8.9318, 13.1702}};
    // 3 pessoas em células de 5 km diferentes, mas na mesma célula de 0,25° (Benguela): centro -12.625, 13.375
    private static final double[][] SPREAD = {{-12.58, 13.40}, {-12.52, 13.45}, {-12.60, 13.30}};

    @Autowired MockMvc mvc;
    @Autowired JwtService jwtService;
    @Autowired ProfileRepository profileRepository;
    @Autowired KycVerificationRepository kycVerificationRepository;
    @Autowired LocationEventRepository eventRepository;
    @Autowired HeatmapService heatmapService;
    @Autowired LocationRetentionScheduler retentionScheduler;

    private Profile admin;

    @BeforeEach
    void setup() {
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
    }

    @Test
    void localizacoesEnviadasPelaAppAparecemNoMapa() throws Exception {
        Heatmap before = heatmapService.heatmap(HeatmapScope.SIGNUP);

        List<Profile> people = new ArrayList<>();
        for (double[] p : SAME_CELL) people.add(report(profile("Luanda " + people.size(), UserRole.RENTER), p));
        for (double[] p : SPREAD) people.add(report(profile("Benguela " + people.size(), UserRole.OWNER), p));

        // cada envio ficou no histórico, arredondado a 2 casas
        for (Profile p : people) {
            assertThat(eventRepository.findByUserIdAndContextOrderByCreatedAtDesc(p.getId(), LocationContext.APP))
                    .singleElement().satisfies(e -> assertThat(e.getLat().scale()).isEqualTo(2));
        }

        mvc.perform(get("/api/v1/admin/metrics/heatmap?scope=SIGNUP").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells[?(@.lat == -8.925 && @.lng == 13.175)].count").value(3))
                .andExpect(jsonPath("$.cells[?(@.lat == -8.925 && @.lng == 13.175)].sizeDeg").value(0.05))
                // espalhados: nenhuma célula de 5 km chega a 3, mas a de 0,25° sim
                .andExpect(jsonPath("$.cells[?(@.lat == -12.625 && @.lng == 13.375)].count").value(3))
                .andExpect(jsonPath("$.cells[?(@.lat == -12.625 && @.lng == 13.375)].sizeDeg").value(0.25))
                .andExpect(jsonPath("$.coarseCellSizeDeg").value(0.25))
                // nunca dados de pessoas
                .andExpect(content().string(not(containsString("Luanda 0"))))
                .andExpect(content().string(not(containsString(people.getFirst().getId().toString()))));

        Heatmap after = heatmapService.heatmap(HeatmapScope.SIGNUP);
        assertThat(after.withLocation() - before.withLocation()).isEqualTo(6);
        assertThat(after.suppressed()).isEqualTo(before.suppressed());
        assertThat(after.cells()).allMatch(c -> c.count() >= 3);

        // KYC enviado (âmbito por omissão do endpoint): só os 3 de Luanda
        for (Profile p : people.subList(0, 3)) submitKyc(p);
        mvc.perform(get("/api/v1/admin/metrics/heatmap").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("KYC_SUBMITTED"))
                .andExpect(jsonPath("$.cells[?(@.lat == -8.925 && @.lng == 13.175)].count").value(3));
    }

    @Test
    void retencaoDoHistoricoNaoEsvaziaOMapa() throws Exception {
        for (int i = 0; i < SAME_CELL.length; i++) report(profile("Retido " + i, UserRole.RENTER), SAME_CELL[i]);
        retentionScheduler.purgeOld();
        mvc.perform(get("/api/v1/admin/metrics/heatmap?scope=SIGNUP").header("Authorization", bearer(admin)))
                .andExpect(jsonPath("$.cells[?(@.lat == -8.925 && @.lng == 13.175)].count").value(3));
    }

    @Test
    void soAdminVeOMapaENinguemRecebeCoordenadas() throws Exception {
        Profile owner = report(profile("Dono", UserRole.OWNER), SAME_CELL[0]);
        mvc.perform(get("/api/v1/admin/metrics/heatmap").header("Authorization", bearer(owner)))
                .andExpect(status().isForbidden());
        // o próprio vê a zona e o consentimento, nunca coordenadas
        mvc.perform(get("/api/v1/me/location").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consented").value(true))
                .andExpect(jsonPath("$.area.province").value("Luanda"))
                .andExpect(jsonPath("$.lat").doesNotExist())
                .andExpect(jsonPath("$.lng").doesNotExist());
        mvc.perform(post("/api/v1/me/location").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"lat\":-8.9,\"lng\":13.2,\"context\":\"NOPE\"}"))
                .andExpect(status().isBadRequest());
    }

    // ---- Helpers ----

    private Profile report(Profile p, double[] point) throws Exception {
        mvc.perform(post("/api/v1/me/location").header("Authorization", bearer(p))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lat\":%s,\"lng\":%s,\"accuracyM\":1500,\"context\":\"APP\"}"
                                .formatted(point[0], point[1])))
                .andExpect(status().isOk());
        return p;
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private void submitKyc(Profile p) {
        kycVerificationRepository.saveAndFlush(KycVerification.builder()
                .profile(p).accountType(AccountType.INDIVIDUAL).status(KycStatus.PENDING)
                .submittedAt(OffsetDateTime.now()).build());
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
    }
}
