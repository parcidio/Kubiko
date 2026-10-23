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
import com.beeznoo.api.common.storage.TestImages;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.profile.entity.EmailVerification;
import com.beeznoo.api.profile.repository.EmailVerificationRepository;
import com.beeznoo.api.profile.service.EmailVerificationService;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.repository.SecurityEventRepository;
import jakarta.servlet.http.Cookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
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
    @Autowired SecurityEventRepository securityEventRepository;
    @Autowired EmailVerificationService emailVerificationService;
    @Autowired EmailVerificationRepository emailVerificationRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired PlatformTransactionManager transactionManager;
    @Value("${jwt.secret}") String jwtSecret;

    private static final AtomicInteger PHONE = new AtomicInteger(923600000);
    private static final String PASSWORD = "Kizomba#Talatona-77";
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

    // ── 2.ª ronda ─────────────────────────────────────────────────────────

    @Test
    void ninguemSeRegistaComoAdmin() {
        assertThatThrownBy(() -> authService.register(new RegisterRequest("Falso Admin", nextPhone(), null, PASSWORD, UserRole.ADMIN)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Tipo de conta inválido");
    }

    @Test
    void admin_loginPedeSegundoFatorPorSms() {
        Profile admin = verifiedProfile(UserRole.ADMIN);

        AuthResponse first = authService.login(new LoginRequest(admin.getPhone(), null, PASSWORD));
        assertThat(first.mfaRequired()).isTrue();
        assertThat(first.accessToken()).isNull();
        assertThat(first.refreshToken()).isNull();

        OtpCode otp = otpCodeRepository.findLatestValid(admin.getPhone(), Purpose.ADMIN_LOGIN).orElseThrow();
        otp.setCodeHash(encoder.encode("246810"));
        otpCodeRepository.save(otp);

        assertThat(first.mfaToken()).isNotBlank();
        AuthResponse tokens = authService.verifyAdminMfa(new AdminMfaRequest(first.mfaToken(), "246810"));
        // o desafio é de uso único
        assertThatThrownBy(() -> authService.verifyAdminMfa(new AdminMfaRequest(first.mfaToken(), "246810")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(securityEventRepository.findByTypeOrderByCreatedAtDesc(SecurityEventType.ADMIN_LOGIN))
                .anySatisfy(e -> assertThat(e.getProfileId()).isEqualTo(admin.getId()));
    }

    @Test
    void admin_cincoErrosNo2FA_bloqueiaEGeraEventoHigh() {
        Profile admin = verifiedProfile(UserRole.ADMIN);
        String mfaToken = authService.login(new LoginRequest(admin.getPhone(), null, PASSWORD)).mfaToken();

        for (int i = 0; i < 5; i++) {
            catchThrowable(() -> authService.verifyAdminMfa(new AdminMfaRequest(mfaToken, "000000")));
        }
        assertThat(securityEventRepository.findByTypeOrderByCreatedAtDesc(SecurityEventType.ADMIN_MFA_FAILED))
                .isNotEmpty()
                .allSatisfy(e -> assertThat(e.getSeverity().name()).isEqualTo("HIGH"))
                .allSatisfy(e -> assertThat(e.getIdentifierHash()).hasSize(64).doesNotContain("244"));
    }

    @Test
    void politicaDePasswords_recusaComunsTelefoneENome() {
        String phone = nextPhone();
        assertThatThrownBy(() -> authService.register(new RegisterRequest("Ana Domingos", phone, null, "Benfica123", UserRole.RENTER)))
                .hasMessageContaining("comum");
        assertThatThrownBy(() -> authService.register(new RegisterRequest("Ana Domingos", phone, null, "x" + phone.substring(4) + "!", UserRole.RENTER)))
                .hasMessageContaining("telefone");
        assertThatThrownBy(() -> authService.register(new RegisterRequest("Ana Domingos", phone, null, "DomingosRules!", UserRole.RENTER)))
                .hasMessageContaining("nome");
    }

    @Test
    void mudarPassword_pedeAAtualERevogaAsOutrasSessoes() {
        Profile p = verifiedProfile(UserRole.RENTER);
        AuthResponse before = authService.login(new LoginRequest(p.getPhone(), null, PASSWORD));

        assertThatThrownBy(() -> authService.changePassword(p.getId(), new ChangePasswordRequest("errada", "Muxima#Kilamba-88")))
                .hasMessageContaining("atual");

        AuthResponse after = authService.changePassword(p.getId(), new ChangePasswordRequest(PASSWORD, "Muxima#Kilamba-88"));
        assertThat(after.accessToken()).isNotBlank();
        assertThatThrownBy(() -> authService.refresh(before.refreshToken())).isInstanceOf(IllegalArgumentException.class);
        assertThat(authService.login(new LoginRequest(p.getPhone(), null, "Muxima#Kilamba-88")).accessToken()).isNotBlank();
    }

    @Test
    void refreshReutilizado_ficaNosEventosDeSeguranca() {
        Profile p = verifiedProfile(UserRole.RENTER);
        AuthResponse first = authService.login(new LoginRequest(p.getPhone(), null, PASSWORD));
        authService.refresh(first.refreshToken());
        catchThrowable(() -> authService.refresh(first.refreshToken()));

        assertThat(securityEventRepository.findByTypeOrderByCreatedAtDesc(SecurityEventType.REFRESH_TOKEN_REUSE))
                .anySatisfy(e -> assertThat(e.getProfileId()).isEqualTo(p.getId()));
    }

    @Test
    void clienteWeb_recebeRefreshEmCookieHttpOnlyERenovaComEle() throws Exception {
        Profile p = verifiedProfile(UserRole.RENTER);
        var login = mvc.perform(post("/api/v1/auth/login").header("X-Beeznoo-Client", "web")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + p.getPhone() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        String setCookie = login.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("bz_refresh=", "HttpOnly", "SameSite=Strict", "Path=/api/v1/auth");

        Cookie cookie = login.getResponse().getCookie("bz_refresh");
        mvc.perform(post("/api/v1/auth/refresh").header("X-Beeznoo-Client", "web").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("bz_refresh=")));
    }

    @Test
    void requestId_eDevolvidoEValoresInsegurosSaoTrocados() throws Exception {
        mvc.perform(get("/api/v1/categories").header("X-Request-Id", "abc-12345-def"))
                .andExpect(header().string("X-Request-Id", "abc-12345-def"));
        mvc.perform(get("/api/v1/categories").header("X-Request-Id", "x\r\nINJECTED: 1"))
                .andExpect(header().string("X-Request-Id", org.hamcrest.Matchers.matchesPattern("[0-9a-f-]{36}")));
    }

    @Test
    void verificacaoDeEmail_cincoTentativasDepoisVerifica() {
        Profile p = verifiedProfile(UserRole.RENTER);
        p.setEmail("ana.verifica@beeznoo.test");
        profileRepository.save(p);
        // email desligado nos testes: pedir código explica porquê
        assertThatThrownBy(() -> emailVerificationService.request(p.getId())).hasMessageContaining("emails");

        emailVerificationRepository.save(EmailVerification.builder()
                .profileId(p.getId()).email(p.getEmail()).codeHash(encoder.encode("135790"))
                .expiresAt(java.time.OffsetDateTime.now().plusMinutes(15)).build());
        assertThatThrownBy(() -> emailVerificationService.confirm(p.getId(), "000000")).hasMessageContaining("incorreto");

        emailVerificationService.confirm(p.getId(), "135790");
        assertThat(profileRepository.findById(p.getId()).orElseThrow().getEmailVerifiedAt()).isNotNull();
    }

    @Test
    void imagensSaoRecodificadas_semDadosEscondidosESemGigantes() {
        byte[] polyglot = concat(TestImages.JPEG, "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8));
        var clean = UploadedFiles.validate(new MockMultipartFile("f", "f.jpg", "image/jpeg", polyglot), "A foto", UploadedFiles.IMAGES);
        assertThat(new String(clean.content(), StandardCharsets.ISO_8859_1)).doesNotContain("<script>");

        byte[] huge = TestImages.image("png", 13_000, 1);
        assertThatThrownBy(() -> UploadedFiles.validate(new MockMultipartFile("f", "f.png", "image/png", huge), "A foto", UploadedFiles.IMAGES))
                .hasMessageContaining("píxeis");
    }

    @Test
    void contadoresNoPostgres_funcionamComoEmMemoria() {
        var store = new com.beeznoo.api.common.security.JdbcRateLimitStore(jdbcTemplate, transactionManager);
        String key = "teste:" + UUID.randomUUID();
        store.increment(key, java.time.Duration.ofMinutes(1));
        var w = store.increment(key, java.time.Duration.ofMinutes(1));
        assertThat(w.count()).isEqualTo(2);
        assertThat(store.current(key).count()).isEqualTo(2);
        store.reset(key);
        assertThat(store.current(key)).isNull();
        // a chave nunca fica em claro
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM rate_limit_counters WHERE key_hash LIKE 'teste:%'", Integer.class)).isZero();
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = java.util.Arrays.copyOf(a, a.length + b.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
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
