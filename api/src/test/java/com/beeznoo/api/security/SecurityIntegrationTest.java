package com.beeznoo.api.security;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.JwtService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.common.security.RateLimitExceededException;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Proteções do OWASP Top 10 aplicadas ao backend. Ver docs/SEGURANCA.md.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@Transactional
class SecurityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean OmbalaSmsService ombalaSmsService;

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired JwtService jwtService;
    @Autowired RateLimiter rateLimiter;
    @Autowired ProfileRepository profileRepository;
    @Autowired OtpCodeRepository otpCodeRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Value("${jwt.secret}") String jwtSecret;

    private static final AtomicInteger PHONE = new AtomicInteger(923600000);
    private static final String PASSWORD = "password123";
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        rateLimiter.clear();
        doNothing().when(ombalaSmsService).sendOtp(anyString(), anyString());
    }

    // ── A01 Controlo de acesso ────────────────────────────────────────────

    @Test
    void rotaProtegidaSemToken_da401_eRotaDeAdminComTokenDeRenter_da403() throws Exception {
        mvc.perform(get("/api/v1/profiles/me")).andExpect(status().isUnauthorized());

        Profile renter = verifiedProfile(UserRole.RENTER);
        String token = jwtService.generateAccessToken(renter.getId(), "RENTER");
        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/profiles/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void tamanhoDePaginaAcimaDe100_eLimitado() throws Exception {
        mvc.perform(get("/api/v1/items").param("size", "5000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100));
    }

    // ── A02 Configuração / A04 Criptografia ───────────────────────────────

    @Test
    void cabecalhosDeSegurancaPresentes() throws Exception {
        mvc.perform(get("/api/v1/categories"))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("default-src 'none'")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().exists("Strict-Transport-Security"))
                .andExpect(header().exists("Permissions-Policy"));
    }

    @Test
    void tokenAssinadoComAMesmaChaveMasSemEmissorOuTipo_eRecusado() throws Exception {
        Profile admin = verifiedProfile(UserRole.ADMIN);
        String forged = Jwts.builder()
                .subject(admin.getId().toString())
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)))
                .compact();

        mvc.perform(get("/api/v1/admin/kyc").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenComAssinaturaAlterada_eRecusado() throws Exception {
        Profile p = verifiedProfile(UserRole.RENTER);
        String token = jwtService.generateAccessToken(p.getId(), "RENTER");
        String tampered = token.substring(0, token.length() - 4) + "AAAA";

        mvc.perform(get("/api/v1/profiles/me").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
    }

    // ── A07 Autenticação ──────────────────────────────────────────────────

    @Test
    void otp_temSeisDigitosEBloqueiaAoQuintoErro() {
        String phone = nextPhone();
        authService.register(new RegisterRequest("Teste OTP", phone, null, PASSWORD, UserRole.RENTER));
        OtpCode otp = otpCodeRepository.findLatestValid(phone, Purpose.REGISTRATION).orElseThrow();
        otp.setCodeHash(encoder.encode("654321"));
        otpCodeRepository.save(otp);

        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> authService.verifyRegistration(new VerifyRegistrationRequest(phone, "000000")))
                    .hasMessageContaining("incorreto");
        }
        assertThatThrownBy(() -> authService.verifyRegistration(new VerifyRegistrationRequest(phone, "000000")))
                .hasMessageContaining("Demasiadas tentativas");
        // mesmo com o código certo, depois do bloqueio já não serve
        assertThatThrownBy(() -> authService.verifyRegistration(new VerifyRegistrationRequest(phone, "654321")))
                .hasMessageContaining("Demasiadas tentativas");
    }

    @Test
    void otp_reenvioImediatoParaOMesmoNumero_eBloqueado() {
        Profile p = verifiedProfile(UserRole.RENTER);
        authService.requestPassword(new PasswordResetRequest(p.getPhone()));

        assertThatThrownBy(() -> authService.requestPassword(new PasswordResetRequest(p.getPhone())))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("Espera um minuto");
    }

    @Test
    void login_forcaBrutaNoMesmoNumero_da429DepoisDe10Tentativas() {
        Profile p = verifiedProfile(UserRole.RENTER);
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(new LoginRequest(p.getPhone(), null, "errada")))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> authService.login(new LoginRequest(p.getPhone(), null, PASSWORD)))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void login_numeroInexistente_daAMesmaMensagemQuePasswordErrada() {
        Profile p = verifiedProfile(UserRole.RENTER);
        String wrongPassword = catchThrowable(() -> authService.login(new LoginRequest(p.getPhone(), null, "errada"))).getMessage();
        String noAccount = catchThrowable(() -> authService.login(new LoginRequest(nextPhone(), null, "errada"))).getMessage();
        assertThat(noAccount).isEqualTo(wrongPassword).isEqualTo("Credenciais inválidas.");
    }

    @Test
    void refresh_reutilizado_revogaTodasAsSessoes() {
        Profile p = verifiedProfile(UserRole.RENTER);
        AuthResponse first = authService.login(new LoginRequest(p.getPhone(), null, PASSWORD));
        AuthResponse second = authService.refresh(first.refreshToken());
        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken()).hasSizeGreaterThanOrEqualTo(43);

        assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
                .hasMessageContaining("Sessão terminada por segurança");
        // o refresh legítimo mais recente também deixou de servir
        assertThatThrownBy(() -> authService.refresh(second.refreshToken()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void codigoDoLoginGoogle_eDeUsoUnico() {
        Profile p = verifiedProfile(UserRole.RENTER);
        String code = authService.issueLoginCode(p.getId());

        AuthResponse tokens = authService.exchangeLoginCode(code);
        assertThat(tokens.accessToken()).isNotBlank();
        assertThatThrownBy(() -> authService.exchangeLoginCode(code)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> authService.exchangeLoginCode("inventado")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void passwordComMaisDe72Bytes_eRecusada() {
        String longPassword = "á".repeat(40); // 80 bytes em UTF-8
        assertThatThrownBy(() -> authService.register(new RegisterRequest("X", nextPhone(), null, longPassword, UserRole.RENTER)))
                .hasMessageContaining("72");
    }

    // ── A06 / limites por IP (HTTP) ───────────────────────────────────────

    @Test
    void pedidosDeOtpPorIp_da429ComRetryAfter() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/v1/auth/password/reset/request").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"phone\":\"" + nextPhone() + "\"}"));
        }
        mvc.perform(post("/api/v1/auth/password/reset/request").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + nextPhone() + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    // ── A10 Condições excecionais ─────────────────────────────────────────

    @Test
    void jsonMalFormado_da400ENao500() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{nao é json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Pedido mal formado."));
    }

    @Test
    void corpoAcimaDe1MB_da413() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + "9".repeat(1_100_000) + "\"}"))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void metodoNaoSuportado_da405() throws Exception {
        mvc.perform(delete("/api/v1/auth/login")).andExpect(status().isMethodNotAllowed());
    }

    // ── Auxiliares ────────────────────────────────────────────────────────

    private String nextPhone() {
        return "+244" + PHONE.incrementAndGet();
    }

    private Profile verifiedProfile(UserRole role) {
        return profileRepository.save(Profile.builder()
                .fullName("Pessoa Teste")
                .phone(nextPhone())
                .passwordHash(encoder.encode(PASSWORD))
                .role(role)
                .isVerified(true)
                .build());
    }
}
