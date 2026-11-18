package com.beeznoo.api.profile;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.dto.AuthDtos.LoginRequest;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.profile.entity.AdminRole;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.AdminUserService;
import com.beeznoo.api.profile.service.AdminUserService.UserSearch;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Admin › Utilizadores: filtros, ordenação, ações com motivo, notas e histórico (decisoes-produto.md 2026-11-18). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminUserManagementIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923720000);
    private static final String PASSWORD = "Kizomba#Talatona-77";

    @MockitoBean OmbalaSmsService ombalaSmsService;

    @Autowired AdminUserService adminUserService;
    @Autowired AuthService authService;
    @Autowired ProfileRepository profileRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired JwtService jwtService;
    @Autowired RateLimiter rateLimiter;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired jakarta.persistence.EntityManager em;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private Profile admin;
    private Profile owner;
    private Profile renter;

    @BeforeEach
    void setup() {
        rateLimiter.clear();
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
        admin.setAdminRole(AdminRole.SUPER_ADMIN);
        admin = profileRepository.saveAndFlush(admin);
        owner = profile("Zélia Owner", UserRole.OWNER);
        renter = profile("Abel Renter", UserRole.RENTER);
    }

    @Test
    void filtrosEOrdenacao() {
        jdbc.update("UPDATE profiles SET created_at = now() - interval '40 days' WHERE id = ?", renter.getId());
        jdbc.update("""
                INSERT INTO kyc_verifications (profile_id, account_type, status, submitted_at) VALUES (?, 'INDIVIDUAL', 'APPROVED', now())
                """, owner.getId());

        assertThat(ids(new UserSearch(null, UserRole.OWNER, null, null, null, null, null, null, null)))
                .contains(owner.getId()).doesNotContain(renter.getId(), admin.getId());
        assertThat(ids(new UserSearch(null, null, "APPROVED", null, null, null, null, null, null)))
                .contains(owner.getId()).doesNotContain(renter.getId());
        assertThat(ids(new UserSearch(null, null, "NONE", null, null, null, null, null, null)))
                .contains(renter.getId()).doesNotContain(owner.getId());
        LocalDate today = LocalDate.now();
        assertThat(ids(new UserSearch(null, null, null, null, null, today.minusDays(1), today.plusDays(1), null, null)))
                .contains(owner.getId()).doesNotContain(renter.getId());

        List<UUID> byName = ids(new UserSearch(null, null, null, null, null, null, null, "name", "asc"));
        assertThat(byName.indexOf(renter.getId())).isLessThan(byName.indexOf(owner.getId())); // Abel antes de Zélia

        assertThatThrownBy(() -> ids(new UserSearch(null, null, "PIZZA", null, null, null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ids(new UserSearch(null, null, null, null, null, null, null, "password_hash", null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ids(new UserSearch(null, null, null, null, null, today, today.minusDays(3), null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void terminarSessoes_revogaRefresh_eAudita() {
        var session = authService.login(new LoginRequest(owner.getPhone(), null, PASSWORD));
        em.flush(); // a ficha conta as sessões por SQL
        assertThat(adminUserService.detail(owner.getId()).activeSessions()).isEqualTo(1);

        assertThatThrownBy(() -> adminUserService.revokeSessions(admin.getId(), owner.getId(), ""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> adminUserService.revokeSessions(admin.getId(), admin.getId(), "Teste próprio"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("self_action");

        adminUserService.revokeSessions(admin.getId(), owner.getId(), "Telemóvel roubado");
        assertThat(adminUserService.detail(owner.getId()).activeSessions()).isZero();
        assertThatThrownBy(() -> authService.refresh(session.refreshToken())).isInstanceOf(IllegalArgumentException.class);
        assertThat(actions(owner.getId())).containsExactly(AuditAction.SESSIONS_REVOKED);
    }

    @Test
    void reporTelefone_obrigaAConfirmar_eOLoginPedeCodigo() {
        adminUserService.resetPhoneVerification(admin.getId(), owner.getId(), "Número reatribuído");
        assertThat(profileRepository.findById(owner.getId()).orElseThrow().isVerified()).isFalse();
        assertThatThrownBy(() -> authService.login(new LoginRequest(owner.getPhone(), null, PASSWORD)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("phone_unverified");
        assertThatThrownBy(() -> adminUserService.resetPhoneVerification(admin.getId(), owner.getId(), "Outra vez"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("phone_not_verified");
        assertThat(actions(owner.getId())).containsExactly(AuditAction.PHONE_VERIFICATION_RESET);
    }

    @Test
    void notasInternas_eHistorico() {
        var note = adminUserService.addNote(admin.getId(), owner.getId(), "  Ligou a pedir ajuda com o KYC.  ");
        assertThat(note.body()).isEqualTo("Ligou a pedir ajuda com o KYC.");
        assertThat(note.authorName()).isEqualTo("Equipa Beeznoo");
        assertThat(adminUserService.notes(owner.getId())).hasSize(1);

        adminUserService.suspend(admin.getId(), owner.getId(), "Anúncio enganador");
        var history = adminUserService.history(owner.getId(), 0, 20).getContent();
        assertThat(history).extracting(h -> h.action())
                .containsExactly(AuditAction.ACCOUNT_SUSPENDED.name(), AuditAction.USER_NOTE_ADDED.name());
        // o texto da nota não vai para a auditoria
        assertThat(history.get(1).reason()).isNull();

        // sem UPDATE na BD (por último: o erro aborta a transação do teste)
        assertThatThrownBy(() -> jdbc.update("UPDATE admin_user_notes SET body = 'x' WHERE id = ?", note.id()))
                .hasMessageContaining("não se altera");
    }

    @Test
    void http_validacao_e404() throws Exception {
        mvc.perform(get("/api/v1/admin/users/{id}", UUID.randomUUID()).header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("user_not_found"));
        mvc.perform(get("/api/v1/admin/users?kyc=XPTO").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?sort=password_hash").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?createdFrom=ontem").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?status=ACTIVE&role=OWNER&sort=name&direction=asc&page=-1&size=5000")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/users/{id}/suspend", owner.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/users/{id}/notes", owner.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"" + "x".repeat(2001) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users/{id}/history", owner.getId()).header("Authorization", bearer(admin)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/bookings?status=NOPE").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/bookings/{id}/history", UUID.randomUUID()).header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound());
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private List<UUID> ids(UserSearch s) {
        return adminUserService.search(s, 0, 100).getContent().stream().map(r -> r.id()).toList();
    }

    private List<AuditAction> actions(UUID entityId) {
        return auditLogRepository.findByEntityIdOrderByCreatedAtAsc(entityId).stream().map(a -> a.getAction()).toList();
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash(encoder.encode(PASSWORD))
                .role(role).isVerified(true).build());
    }
}
