package com.beeznoo.api.team;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.repository.AuditLogRepository;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.common.storage.MockStorageService;
import com.beeznoo.api.profile.entity.AdminRole;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.team.dto.TeamDtos.InvitationResponse;
import com.beeznoo.api.team.dto.TeamDtos.InviteRequest;
import com.beeznoo.api.team.entity.AdminInvitation.InvitationStatus;
import com.beeznoo.api.team.service.TeamAccessService;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Acesso ao Admin por convite, papéis da equipa e autorização por área (decisoes-produto.md 2026-11-18). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class AdminTeamAccessIntegrationTest {

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

    private static final AtomicInteger PHONE = new AtomicInteger(923710000);

    @Autowired TeamAccessService teamAccessService;
    @Autowired ProfileRepository profileRepository;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired JwtService jwtService;
    @Autowired RateLimiter rateLimiter;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired jakarta.persistence.EntityManager em;

    private Profile superAdmin;
    private Profile user;

    @BeforeEach
    void setup() {
        rateLimiter.clear();
        superAdmin = admin("Equipa Beeznoo", AdminRole.SUPER_ADMIN);
        user = profile("Ana Domingos", UserRole.OWNER, null);
    }

    // ── Ciclo de vida do convite ──────────────────────────────────────────

    @Test
    void convitePorConta_aceitar_daOPapel_usoUnico_eFicaNaAuditoria() {
        InvitationResponse inv = teamAccessService.invite(superAdmin.getId(),
                new InviteRequest(user.getId(), null, AdminRole.TRUST, "Entra para as verificações"));
        assertThat(inv.status()).isEqualTo(InvitationStatus.PENDING);
        assertThat(inv.inviteUrl()).contains("/convite-equipa#");
        String token = token(inv);

        // o token não fica guardado em claro
        String stored = jdbc.queryForObject("SELECT token_hash FROM admin_invitations WHERE id = ?", String.class, inv.id());
        assertThat(stored).hasSize(64).isNotEqualTo(token);

        var preview = teamAccessService.inspect(user.getId(), token);
        assertThat(preview.forYou()).isTrue();
        assertThat(preview.adminRole()).isEqualTo(AdminRole.TRUST);

        var accepted = teamAccessService.accept(user.getId(), token);
        assertThat(accepted.reauthRequired()).isTrue();
        Profile after = profileRepository.findById(user.getId()).orElseThrow();
        assertThat(after.getRole()).isEqualTo(UserRole.ADMIN);
        assertThat(after.getAdminRole()).isEqualTo(AdminRole.TRUST);

        // uso único
        assertThatThrownBy(() -> teamAccessService.accept(user.getId(), token))
                .isInstanceOf(ApiException.class).extracting("code").isIn("invitation_used", "already_admin");

        assertThat(actions(inv.id())).containsExactly(AuditAction.ADMIN_INVITED);
        assertThat(actions(user.getId())).contains(AuditAction.ADMIN_INVITATION_ACCEPTED);
    }

    @Test
    void conviteParaOutraConta_expirado_ouRevogado_naoSeAceita() {
        Profile intruder = profile("Pedro Neto", UserRole.RENTER, null);
        String token = token(teamAccessService.invite(superAdmin.getId(), new InviteRequest(user.getId(), null, AdminRole.GROWTH, null)));

        assertThatThrownBy(() -> teamAccessService.accept(intruder.getId(), token))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("not_for_you");
        assertThat(profileRepository.findById(intruder.getId()).orElseThrow().getRole()).isEqualTo(UserRole.RENTER);

        jdbc.update("UPDATE admin_invitations SET expires_at = now() - interval '1 minute'");
        em.clear(); // o teste corre numa só transação: esquece o convite em cache
        assertThatThrownBy(() -> teamAccessService.accept(user.getId(), token))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("invitation_expired");

        Profile other = profile("Rui Lopes", UserRole.RENTER, null);
        InvitationResponse inv2 = teamAccessService.invite(superAdmin.getId(), new InviteRequest(other.getId(), null, AdminRole.GROWTH, null));
        teamAccessService.revokeInvitation(superAdmin.getId(), inv2.id(), "Enviado por engano");
        assertThatThrownBy(() -> teamAccessService.accept(other.getId(), token(inv2)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("invitation_revoked");
        assertThat(actions(inv2.id())).containsExactly(AuditAction.ADMIN_INVITED, AuditAction.ADMIN_INVITATION_REVOKED);

        assertThatThrownBy(() -> teamAccessService.accept(user.getId(), "token-que-nao-existe-de-todo-123"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("invitation_invalid");
    }

    @Test
    void convitePorEmail_exigeEmailConfirmadoDaMesmaConta() {
        Profile invitee = profile("Marta Silva", UserRole.RENTER, "marta@exemplo.ao");
        String token = token(teamAccessService.invite(superAdmin.getId(), new InviteRequest(null, "Marta@Exemplo.ao", AdminRole.OPERATIONS, null)));

        assertThatThrownBy(() -> teamAccessService.accept(invitee.getId(), token))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("email_unverified");
        assertThatThrownBy(() -> teamAccessService.accept(user.getId(), token))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("not_for_you");

        invitee.setEmailVerifiedAt(OffsetDateTime.now());
        profileRepository.saveAndFlush(invitee);
        teamAccessService.accept(invitee.getId(), token);
        assertThat(profileRepository.findById(invitee.getId()).orElseThrow().getAdminRole()).isEqualTo(AdminRole.OPERATIONS);
    }

    @Test
    void guardasDoConvite() {
        assertThatThrownBy(() -> teamAccessService.invite(superAdmin.getId(), new InviteRequest(null, null, AdminRole.TRUST, null)))
                .isInstanceOf(IllegalArgumentException.class);
        Profile otherAdmin = admin("Outro Admin", AdminRole.GROWTH);
        assertThatThrownBy(() -> teamAccessService.invite(superAdmin.getId(), new InviteRequest(otherAdmin.getId(), null, AdminRole.TRUST, null)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("already_admin");

        teamAccessService.invite(superAdmin.getId(), new InviteRequest(user.getId(), null, AdminRole.TRUST, null));
        assertThatThrownBy(() -> teamAccessService.invite(superAdmin.getId(), new InviteRequest(user.getId(), null, AdminRole.GROWTH, null)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("invite_pending");

        Profile suspended = profile("Conta Suspensa", UserRole.RENTER, null);
        suspended.setSuspendedAt(OffsetDateTime.now());
        suspended.setSuspensionReason("Teste");
        profileRepository.saveAndFlush(suspended);
        assertThatThrownBy(() -> teamAccessService.invite(superAdmin.getId(), new InviteRequest(suspended.getId(), null, AdminRole.TRUST, null)))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("account_suspended");
    }

    // ── Papéis e retirar acesso ───────────────────────────────────────────

    @Test
    void mudarPapel_eRetirarAcesso_comProtecoes() {
        Profile ops = admin("Operações", AdminRole.OPERATIONS);

        assertThatThrownBy(() -> teamAccessService.changeRole(superAdmin.getId(), superAdmin.getId(), AdminRole.GROWTH, "Auto despromoção"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("self_change");
        assertThatThrownBy(() -> teamAccessService.revokeAccess(superAdmin.getId(), superAdmin.getId(), "Sair da equipa"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("self_change");

        var changed = teamAccessService.changeRole(superAdmin.getId(), ops.getId(), AdminRole.TRUST, "Passa para verificações");
        assertThat(changed.adminRole()).isEqualTo(AdminRole.TRUST);

        teamAccessService.revokeAccess(superAdmin.getId(), ops.getId(), "Saiu da equipa");
        Profile revoked = profileRepository.findById(ops.getId()).orElseThrow();
        assertThat(revoked.getRole()).isEqualTo(UserRole.BOTH);
        assertThat(revoked.getAdminRole()).isNull();
        assertThat(actions(ops.getId())).containsExactly(AuditAction.ADMIN_ROLE_CHANGED, AuditAction.ADMIN_ACCESS_REVOKED);
        assertThatThrownBy(() -> teamAccessService.revokeAccess(superAdmin.getId(), ops.getId(), "Outra vez"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("member_not_found");
    }

    @Test
    void ficaSemprePeloMenosUmSuperAdmin() {
        Profile second = admin("Segundo Super", AdminRole.SUPER_ADMIN);
        // o segundo despromove o primeiro: fica ele
        teamAccessService.changeRole(second.getId(), superAdmin.getId(), AdminRole.GROWTH, "Reorganização");
        // um GROWTH não chega aqui por HTTP, mas mesmo pelo serviço o último super não sai
        assertThatThrownBy(() -> teamAccessService.revokeAccess(superAdmin.getId(), second.getId(), "Tentativa"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("last_super_admin");
        assertThatThrownBy(() -> teamAccessService.changeRole(superAdmin.getId(), second.getId(), AdminRole.TRUST, "Tentativa"))
                .isInstanceOf(ApiException.class).extracting("code").isEqualTo("last_super_admin");
    }

    // ── Autorização por HTTP ──────────────────────────────────────────────

    @Test
    void autorizacaoPorArea() throws Exception {
        Profile growth = admin("Crescimento", AdminRole.GROWTH);
        Profile trust = admin("Confiança", AdminRole.TRUST);
        Profile ops = admin("Operações", AdminRole.OPERATIONS);

        // Equipa e auditoria: só SUPER_ADMIN
        mvc.perform(get("/api/v1/admin/team").header("Authorization", bearer(superAdmin))).andExpect(status().isOk());
        for (Profile p : List.of(growth, trust, ops)) {
            mvc.perform(get("/api/v1/admin/team").header("Authorization", bearer(p))).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization", bearer(p))).andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/admin/team/invitations").header("Authorization", bearer(p))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"userId\":\"" + user.getId() + "\",\"adminRole\":\"SUPER_ADMIN\"}"))
                    .andExpect(status().isForbidden());
        }
        // KYC: TRUST sim, GROWTH e OPERATIONS não
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(trust))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(growth))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", bearer(ops))).andExpect(status().isForbidden());
        // Operação: OPERATIONS sim, TRUST não
        mvc.perform(get("/api/v1/admin/bookings").header("Authorization", bearer(ops))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/bookings").header("Authorization", bearer(trust))).andExpect(status().isForbidden());
        // Utilizadores: todos leem; só TRUST/SUPER suspendem
        mvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(growth))).andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/users/{id}/suspend", user.getId()).header("Authorization", bearer(ops))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Anúncio falso\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/users/{id}/suspend", user.getId()).header("Authorization", bearer(trust))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Anúncio falso\"}"))
                .andExpect(status().isOk());
        // Visão geral: todos
        mvc.perform(get("/api/v1/admin/metrics").header("Authorization", bearer(growth))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/access/me").header("Authorization", bearer(growth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminRole").value("GROWTH"));
        // Renter: nada do Admin
        mvc.perform(get("/api/v1/admin/access/me").header("Authorization", bearer(user))).andExpect(status().isForbidden());
    }

    @Test
    void oBotaoTornarAdminDesapareceu_eOConviteAceitaSePorHttp() throws Exception {
        mvc.perform(patch("/api/v1/admin/users/{id}/role", user.getId()).header("Authorization", bearer(superAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"admin\":true}"))
                .andExpect(r -> assertThat(r.getResponse().getStatus()).isIn(404, 405));
        assertThat(profileRepository.findById(user.getId()).orElseThrow().getRole()).isEqualTo(UserRole.OWNER);

        String body = mvc.perform(post("/api/v1/admin/team/invitations").header("Authorization", bearer(superAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + user.getId() + "\",\"adminRole\":\"GROWTH\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = body.replaceAll(".*convite-equipa#([A-Za-z0-9_-]+).*", "$1");
        String oldToken = bearer(user); // emitido enquanto ainda era OWNER

        // token inválido no corpo → 400; o token nunca vai no URL
        mvc.perform(post("/api/v1/team-access/invitations/accept").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/team-access/invitations/accept").header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reauthRequired").value(true));
        // o token antigo (RENTER/OWNER) não dá acesso; o papel novo vale depois de entrar outra vez
        mvc.perform(get("/api/v1/admin/access/me").header("Authorization", oldToken)).andExpect(status().isForbidden());
        Profile now = profileRepository.findById(user.getId()).orElseThrow();
        mvc.perform(get("/api/v1/admin/access/me").header("Authorization", bearer(now)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.adminRole").value("GROWTH"));
    }

    @Test
    void retirarAcesso_tokenAntigoPerdePoderesJa() throws Exception {
        Profile ops = admin("Operações", AdminRole.OPERATIONS);
        String opsToken = bearer(ops);
        mvc.perform(get("/api/v1/admin/bookings").header("Authorization", opsToken)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/team/{id}/revoke", ops.getId()).header("Authorization", bearer(superAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Saiu da equipa\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/admin/bookings").header("Authorization", opsToken)).andExpect(status().isForbidden());
        // motivo obrigatório
        mvc.perform(post("/api/v1/admin/team/{id}/revoke", UUID.randomUUID()).header("Authorization", bearer(superAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private static String token(InvitationResponse inv) {
        return inv.inviteUrl().substring(inv.inviteUrl().indexOf('#') + 1);
    }

    private List<AuditAction> actions(UUID entityId) {
        return auditLogRepository.findByEntityIdOrderByCreatedAtAsc(entityId).stream().map(a -> a.getAction()).toList();
    }

    private String bearer(Profile p) {
        return "Bearer " + jwtService.generateAccessToken(p.getId(), p.getRole().name());
    }

    private Profile admin(String name, AdminRole adminRole) {
        Profile p = profile(name, UserRole.ADMIN, null);
        p.setAdminRole(adminRole);
        return profileRepository.saveAndFlush(p);
    }

    private Profile profile(String name, UserRole role, String email) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName(name).phone("+244" + PHONE.incrementAndGet()).email(email).passwordHash("$2a$10$hash")
                .role(role).isVerified(true).build());
    }

    @SuppressWarnings("unused")
    private long auditCount(AuditAction action) {
        return auditLogRepository.search(null, null, action, null, PageRequest.of(0, 1)).getTotalElements();
    }
}
