package com.beeznoo.api.auth;

import com.beeznoo.api.auth.dto.AuthDtos.RegisterRequest;
import com.beeznoo.api.auth.security.OAuth2SuccessHandler;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.GoogleLinkService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;

/** Associar Google com sessão iniciada + emails sem diferença de maiúsculas (decisoes-produto.md 2026-11-11). */
@SpringBootTest
@Testcontainers
@Transactional
class GoogleLinkIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final AtomicInteger PHONE = new AtomicInteger(923900000);

    // o registo envia OTP por SMS: sem fornecedor nos testes
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    com.beeznoo.api.auth.service.OmbalaSmsService smsService;

    @Autowired OAuth2SuccessHandler handler;
    @Autowired GoogleLinkService googleLinkService;
    @Autowired AuthService authService;
    @Autowired ProfileRepository profileRepository;

    @Test
    void associarComSessao_ligaOGoogle_eVerificaOEmailIgual() throws Exception {
        // conta antiga com o email em maiúsculas e não verificado (o caso que dava email_in_use sem saída)
        Profile me = profile("Vicor.Teste@Gmail.com", null);
        MockHttpServletRequest request = new MockHttpServletRequest();
        googleLinkService.start(me.getId(), request);

        MockHttpServletResponse response = googleLogin(request, "g-sub-1", "vicor.teste@gmail.com");

        assertThat(response.getRedirectedUrl()).endsWith("/conta?google=linked");
        Profile after = profileRepository.findById(me.getId()).orElseThrow();
        assertThat(after.getGoogleId()).isEqualTo("g-sub-1");
        assertThat(after.getEmailVerifiedAt()).isNotNull();
        assertThat(after.getEmail()).isEqualTo("vicor.teste@gmail.com");

        // a intenção é de uso único: o próximo login Google é um login normal e entra direto
        MockHttpServletResponse again = googleLogin(new MockHttpServletRequest(), "g-sub-1", "vicor.teste@gmail.com");
        assertThat(again.getRedirectedUrl()).contains("/oauth2/callback?status=success&code=");
    }

    @Test
    void contaGoogleJaNoutroPerfil_recusa() throws Exception {
        profile("outro@exemplo.ao", "g-sub-2");
        Profile me = profile("eu@exemplo.ao", null);
        MockHttpServletRequest request = new MockHttpServletRequest();
        googleLinkService.start(me.getId(), request);

        assertThat(googleLogin(request, "g-sub-2", "outro@exemplo.ao").getRedirectedUrl()).endsWith("/conta?google=conflict");
        assertThat(profileRepository.findById(me.getId()).orElseThrow().getGoogleId()).isNull();
    }

    @Test
    void perfilJaComGoogle_naoComecaOutraAssociacao() {
        Profile me = profile("ja@exemplo.ao", "g-sub-3");
        assertThatThrownBy(() -> googleLinkService.start(me.getId(), new MockHttpServletRequest()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void semSessao_emailExistenteNaoVerificado_comMaiusculasDiferentes_daEmailInUse() throws Exception {
        profile("Maria.Kiala@Gmail.com", null);
        MockHttpServletResponse response = googleLogin(new MockHttpServletRequest(), "g-sub-4", "maria.kiala@gmail.com");
        // antes: não encontrava a conta (maiúsculas) e criava um registo pendente → segunda conta com o mesmo email
        assertThat(response.getRedirectedUrl()).endsWith("/oauth2/callback?status=email_in_use");
    }

    @Test
    void semSessao_emailVerificadoComMaiusculasDiferentes_associaAutomaticamente() throws Exception {
        Profile p = profile("Joao.Neto@Gmail.com", null);
        p.setEmailVerifiedAt(OffsetDateTime.now());
        profileRepository.saveAndFlush(p);

        assertThat(googleLogin(new MockHttpServletRequest(), "g-sub-5", "joao.neto@gmail.com").getRedirectedUrl())
                .contains("status=success&code=");
        assertThat(profileRepository.findById(p.getId()).orElseThrow().getGoogleId()).isEqualTo("g-sub-5");
    }

    @Test
    void registo_normalizaEmail_eRecusaOMesmoEmailComOutrasMaiusculas() {
        profile("ana@exemplo.ao", null);
        assertThatThrownBy(() -> authService.register(new RegisterRequest(
                "Ana Outra", "+244" + PHONE.incrementAndGet(), "  ANA@Exemplo.AO ", "Kizomba#Talatona-77", UserRole.RENTER)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("email");

        String phone = "+244" + PHONE.incrementAndGet();
        authService.register(new RegisterRequest("Bento Novo", phone, "  Bento.Novo@Exemplo.AO ", "Kizomba#Talatona-77", UserRole.RENTER));
        assertThat(profileRepository.findByPhone(phone).orElseThrow().getEmail()).isEqualTo("bento.novo@exemplo.ao");
        assertThat(profileRepository.findByEmailIgnoreCase("BENTO.NOVO@exemplo.ao")).isPresent();
    }

    // ─── apoio ───

    private MockHttpServletResponse googleLogin(MockHttpServletRequest request, String sub, String email) throws Exception {
        OidcIdToken idToken = new OidcIdToken("token", Instant.now(), Instant.now().plusSeconds(60),
                Map.of("sub", sub, "email", email, "email_verified", true, "name", "Utilizador Teste"));
        var authorities = List.of(new SimpleGrantedAuthority("OIDC_USER"));
        var user = new DefaultOidcUser(authorities, idToken);
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, new OAuth2AuthenticationToken(user, authorities, "google"));
        return response;
    }

    private Profile profile(String email, String googleId) {
        return profileRepository.saveAndFlush(Profile.builder()
                .fullName("Pessoa " + UUID.randomUUID().toString().substring(0, 4))
                .phone("+244" + PHONE.incrementAndGet())
                .email(email)
                .googleId(googleId)
                .passwordHash("$2a$10$hash")
                .role(UserRole.RENTER)
                .isVerified(true)
                .build());
    }
}
