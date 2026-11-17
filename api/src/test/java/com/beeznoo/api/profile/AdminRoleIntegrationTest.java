package com.beeznoo.api.profile;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.profile.service.AdminUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Promover/retirar admin (decisoes-produto.md 2026-11-17, decisão 1). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminRoleIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923700000);

    @Autowired AdminUserService adminUserService;
    @Autowired ProfileRepository profileRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired JwtService jwtService;
    @Autowired MockMvc mvc;

    private Profile admin;
    private Profile user;

    @BeforeEach
    void setup() {
        admin = profile("Equipa Beeznoo", UserRole.ADMIN);
        user = profile("Ana Domingos", UserRole.OWNER);
    }

    @Test
    void promoveERetira_voltaABoth_eFicaNaAuditoria() {
        var promoted = adminUserService.changeRole(admin.getId(), user.getId(), true);
        assertThat(promoted.role()).isEqualTo("ADMIN");
        assertThat(ids(adminUserService.search(null, false, UserRole.ADMIN, 0, 20).getContent()))
                .containsExactlyInAnyOrder(admin.getId(), user.getId());

        var demoted = adminUserService.changeRole(admin.getId(), user.getId(), false);
        assertThat(demoted.role()).isEqualTo("BOTH");
        assertThat(ids(adminUserService.search(null, false, UserRole.ADMIN, 0, 20).getContent()))
                .containsExactly(admin.getId());

        var logs = auditLogRepository.search("ACCOUNT", user.getId(), AuditAction.USER_ROLE_CHANGED, null,
                PageRequest.of(0, 10)).getContent();
        assertThat(logs).hasSize(2);
        assertThat(logs).extracting(l -> l.getMetadata().get("to")).containsExactlyInAnyOrder("ADMIN", "BOTH");
    }

    @Test
    void semMudanca_naoAudita() {
        adminUserService.changeRole(admin.getId(), user.getId(), false);
        assertThat(auditLogRepository.search("ACCOUNT", user.getId(), AuditAction.USER_ROLE_CHANGED, null,
                PageRequest.of(0, 10)).getContent()).isEmpty();
    }

    @Test
    void guardas_selfDemotion_lastAdmin_accountSuspended() {
        assertThatThrownBy(() -> adminUserService.changeRole(admin.getId(), admin.getId(), false))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("self_demotion");

        // outro admin tenta retirar o único admin restante
        Profile other = profile("Outro Admin", UserRole.ADMIN);
        adminUserService.changeRole(admin.getId(), other.getId(), false);
        Profile third = profile("Terceiro", UserRole.ADMIN);
        adminUserService.changeRole(third.getId(), admin.getId(), false);
        assertThatThrownBy(() -> adminUserService.changeRole(admin.getId(), third.getId(), false))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("last_admin");

        user.setSuspendedAt(OffsetDateTime.now());
        user.setSuspensionReason("Teste");
        profileRepository.saveAndFlush(user);
        assertThatThrownBy(() -> adminUserService.changeRole(third.getId(), user.getId(), true))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("account_suspended");
    }

    @Test
    void endpoint_devolveCodigo_eTokenAntigoDeAdminDespromovidoPerdePoderes() throws Exception {
        Profile second = profile("Segundo Admin", UserRole.ADMIN);
        String secondToken = bearer(second);

        mvc.perform(patch("/api/v1/admin/users/{id}/role", admin.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("self_demotion"));
        mvc.perform(patch("/api/v1/admin/users/{id}/role", user.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/admin/users/{id}/role", user.getId()).header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":true}"))
                .andExpect(status().isForbidden());

        mvc.perform(patch("/api/v1/admin/users/{id}/role", second.getId()).header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("BOTH"));

        // o token emitido quando era admin ainda é válido, mas o papel vem da BD
        mvc.perform(get("/api/v1/admin/users").header("Authorization", secondToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/users?role=ADMIN").header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/admin/users?role=CHEFE").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private static java.util.List<java.util.UUID> ids(java.util.List<com.beeznoo.api.profile.dto.AdminUserDtos.AdminUserSummary> rows) {
        return rows.stream().map(r -> r.id()).toList();
    }

    private Profile profile(String name, UserRole role) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
    }
}
