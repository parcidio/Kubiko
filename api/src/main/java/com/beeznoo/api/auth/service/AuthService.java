package com.beeznoo.api.auth.service;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.entity.GooglePendingSignup;
import com.beeznoo.api.auth.entity.OAuthLoginCode;
import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import com.beeznoo.api.auth.entity.RefreshToken;
import com.beeznoo.api.auth.repository.GooglePendingSignupRepository;
import com.beeznoo.api.auth.repository.OAuthLoginCodeRepository;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.config.JwtProperties;
import com.beeznoo.api.config.OmbalaProperties;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    // Limites por identificador (os por IP estão no RateLimitFilter). Ver claude/decisoes-produto.md (2026-10-23, segurança).
    static final int LOGIN_ATTEMPTS = 10;
    static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    static final Duration OTP_RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final int OTP_SENDS_PER_HOUR = 5;
    static final int OTP_VERIFY_ATTEMPTS = 10;
    static final int OTP_FAILURES_PER_CODE = 5;
    static final Duration LOGIN_CODE_TTL = Duration.ofSeconds(60);
    // bcrypt ignora tudo depois de 72 bytes
    static final int MAX_PASSWORD_BYTES = 72;

    private final AccountRepository accountRepository;
    private final OtpCodeRepository otpCodeRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ProfileRepository profileRepository;
    private final GooglePendingSignupRepository googlePendingSignupRepository;
    private final OmbalaSmsService ombalaSmsService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final OmbalaProperties ombalaProperties;
    private final OAuthLoginCodeRepository oAuthLoginCodeRepository;
    private final RateLimiter rateLimiter;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();
    // Comparado quando o perfil não existe, para o tempo de resposta não revelar se o número está registado
    private final String dummyHash = encoder.encode("beeznoo-timing-guard");

    @Transactional
    public void register(RegisterRequest request) {
        assertPasswordLength(request.password());
        if (profileRepository.existsByPhone(request.phone())) {
            throw new IllegalArgumentException("Ester número já está registado.");
        }
        if (request.email() != null && profileRepository.existsByEmail(request.email())) {
            throw  new IllegalArgumentException("Este email já está em uso.");
        }

        Profile profile = Profile.builder()
                .fullName(request.fullName())
                .phone(request.phone())
                .email(request.email())
                .passwordHash(encoder.encode(request.password()))
                .role(request.role())
                .isVerified(false)
                .build();

        profileRepository.save(profile);

        accountRepository.save(Account.builder().profile(profile).build());

        sendOtp(request.phone(), Purpose.REGISTRATION);
    }

    @Transactional
    public AuthResponse verifyRegistration(VerifyRegistrationRequest request) {
        consumeOtp(request.phone(), request.code(), Purpose.REGISTRATION);

        Profile profile = profileRepository.findByPhone(request.phone())
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado."));

        profile.setVerified(true);
        profileRepository.save(profile);

        log.info("Registo concluído para {}", maskPhone(request.phone()));
        return issueTokens(profile);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        if (request.phone() == null && request.email() == null) {
            throw new IllegalArgumentException("Número de telefone ou email é obrigatório.");
        }

        String identifier = request.phone() != null ? request.phone().strip() : request.email().strip().toLowerCase();
        rateLimiter.check("login-id:" + identifier, LOGIN_ATTEMPTS, LOGIN_WINDOW,
                "Demasiadas tentativas de entrar com esta conta. Tenta daqui a 15 minutos ou recupera a password.");

        var found = request.phone() != null
                ? profileRepository.findByPhone(request.phone())
                : profileRepository.findByEmail(request.email());

        // Compara sempre um hash (real ou fictício): mesma resposta e mesmo tempo com ou sem conta
        String hash = found.map(Profile::getPasswordHash).filter(h -> !h.isBlank()).orElse(dummyHash);
        boolean matches = encoder.matches(request.password(), hash);
        if (found.isEmpty() || !matches || found.get().getPasswordHash().isBlank()) {
            log.warn("Login falhado para {}", maskIdentifier(identifier));
            throw new IllegalArgumentException("Credenciais inválidas.");
        }
        Profile profile = found.get();

        if (!profile.isVerified()) {
            throw new IllegalArgumentException("Número de Telefone ainda não verificado. Verifica o teu SMS.");
        }

        rateLimiter.reset("login-id:" + identifier);
        return issueTokens(profile);
    }

    @Transactional
    public AuthResponse issueTokensForProfile(UUID profileId) {
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado."));
        return issueTokens(profile);
    }

    @Transactional
    public void registerGoogle(GoogleRegisterRequest request) {
        GooglePendingSignup pending = findValidPendingSignup(request.pendingToken());

        if (profileRepository.existsByPhone(request.phone())) {
            throw new IllegalArgumentException("Ester número já está registado.");
        }

        pending.setPhone(request.phone());
        pending.setRole(request.role());
        googlePendingSignupRepository.save(pending);

        sendOtp(request.phone(), Purpose.GOOGLE_REGISTRATION);
    }

    @Transactional
    public AuthResponse verifyGoogleRegistration(GoogleVerifyRequest request) {
        GooglePendingSignup pending = findValidPendingSignup(request.pendingToken());

        if (pending.getPhone() == null || pending.getRole() == null) {
            throw new IllegalArgumentException("Submete primeiro o teu número de telefone.");
        }

        consumeOtp(pending.getPhone(), request.code(), Purpose.GOOGLE_REGISTRATION);

        if (profileRepository.existsByGoogleId(pending.getGoogleId())) {
            throw new IllegalStateException("Esta conta Google já está associada a outro perfil.");
        }

        Profile profile = Profile.builder()
                .fullName(pending.getFullName() != null ? pending.getFullName() : "Utilizador Beeznoo")
                .phone(pending.getPhone())
                .email(pending.getEmail())
                .passwordHash("")
                .googleId(pending.getGoogleId())
                .avatarUrl(pending.getAvatarUrl())
                .role(pending.getRole())
                .isVerified(true)
                .build();

        profileRepository.save(profile);
        accountRepository.save(Account.builder().profile(profile).build());
        googlePendingSignupRepository.delete(pending);

        log.info("Registo via Google concluído para {}", maskPhone(pending.getPhone()));
        return issueTokens(profile);
    }

    private GooglePendingSignup findValidPendingSignup(String token) {
        UUID tokenId;
        try {
            tokenId = UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Pedido de registo Google inválido ou expirado.");
        }

        GooglePendingSignup pending = googlePendingSignupRepository.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido de registo Google inválido ou expirado."));

        if (pending.isExpired()) {
            googlePendingSignupRepository.delete(pending);
            throw new IllegalArgumentException("Pedido de registo Google expirado. Inicia sessão com o Google novamente.");
        }

        return pending;
    }

    @Transactional
    public void requestPassword(PasswordResetRequest request) {
        if (profileRepository.existsByPhone(request.phone())) {
            sendOtp(request.phone(), Purpose.PASSWORD_RESET);
        }
    }

    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmRequest request) {
        assertPasswordLength(request.newPassword());
        consumeOtp(request.phone(), request.code(), Purpose.PASSWORD_RESET);

        Profile profile = profileRepository.findByPhone(request.phone())
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado."));

        profile.setPasswordHash(encoder.encode(request.newPassword()));
        profileRepository.save(profile);

        refreshTokenRepository.revokedAllForProfile(profile.getId());

        log.info("Password redefinida para {}", maskPhone(request.phone()));
    }

    // noRollbackFor: a revogação de todas as sessões (refresh reutilizado) tem de ficar gravada mesmo com o erro
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public AuthResponse refresh(String rawRefreshToken) {
        String hashedToken = hashToken(rawRefreshToken);
        RefreshToken token = refreshTokenRepository
                .findByTokenHash(hashedToken)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token inválido."));

        if (token.isRevoked()) {
            // Um refresh já usado voltou a aparecer: alguém tem uma cópia. Fecha todas as sessões.
            refreshTokenRepository.revokedAllForProfile(token.getProfile().getId());
            log.warn("Refresh token reutilizado — todas as sessões revogadas para profileId={}", token.getProfile().getId());
            throw new IllegalArgumentException("Sessão terminada por segurança. Entra outra vez.");
        }
        if (!token.isValid()) {
            throw new IllegalArgumentException("Refresh token expirado ou revogado.");
        }

        token.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(token);

        return issueTokens(token.getProfile());
    }

    @Transactional
    public void logout(UUID profileId) {
        refreshTokenRepository.revokedAllForProfile(profileId);
        log.info("Logout: refresh tokens revogados para profileId={}", profileId);
    }

    // Código de uso único para o redirect do Google (os tokens nunca vão na URL)
    @Transactional
    public String issueLoginCode(UUID profileId) {
        String raw = randomToken();
        oAuthLoginCodeRepository.save(OAuthLoginCode.builder()
                .codeHash(hashToken(raw))
                .profile(profileRepository.getReferenceById(profileId))
                .expiresAt(OffsetDateTime.now().plus(LOGIN_CODE_TTL))
                .build());
        return raw;
    }

    @Transactional
    public AuthResponse exchangeLoginCode(String rawCode) {
        OAuthLoginCode code = oAuthLoginCodeRepository.findByCodeHashForUpdate(hashToken(rawCode))
                .filter(c -> c.isUsableAt(OffsetDateTime.now()))
                .orElseThrow(() -> new IllegalArgumentException("Código de início de sessão inválido ou expirado. Entra outra vez."));
        code.setUsedAt(OffsetDateTime.now());
        return issueTokens(code.getProfile());
    }

    // Limpeza dos códigos de login Google expirados (ficam só 60 s válidos)
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void purgeExpiredLoginCodes() {
        oAuthLoginCodeRepository.deleteExpiredBefore(OffsetDateTime.now().minusHours(1));
    }

    private void sendOtp(String phone, Purpose purpose) {
        // Contra abuso de SMS (custam dinheiro) e força bruta por reenvio
        rateLimiter.check("otp-cooldown:" + purpose + ":" + phone, 1, OTP_RESEND_COOLDOWN,
                "Espera um minuto antes de pedir outro código.");
        rateLimiter.check("otp-send:" + phone, OTP_SENDS_PER_HOUR, Duration.ofHours(1),
                "Pediste demasiados códigos para este número. Tenta daqui a uma hora.");

        otpCodeRepository.invalidateAllForPhone(phone, purpose);

        // 6 dígitos uniformes: 100000–999999
        String code = String.valueOf(100_000 + secureRandom.nextInt(900_000));

        otpCodeRepository.save(OtpCode.builder()
                .phone(phone)
                .purpose(purpose)
                .codeHash(encoder.encode(code))
                .expiresAt(OffsetDateTime.now().plusMinutes(ombalaProperties.otpExpirationMinutes()))
                .build());

        ombalaSmsService.sendOtp(phone, code);
    }

    private void consumeOtp(String phone, String code, Purpose purpose) {
        rateLimiter.check("otp-verify:" + phone, OTP_VERIFY_ATTEMPTS, Duration.ofMinutes(15),
                "Demasiadas tentativas. Pede um código novo daqui a 15 minutos.");

        OtpCode otpCode = otpCodeRepository.findLatestValid(phone, purpose)
                .orElseThrow(() -> new IllegalArgumentException("Código inválido ou expirado. Solicita um novo."));

        // Contador em memória: sobrevive ao rollback da transação quando o código está errado
        String failures = "otp-fail:" + otpCode.getId();
        if (rateLimiter.isExceeded(failures, OTP_FAILURES_PER_CODE)) {
            throw new IllegalArgumentException("Demasiadas tentativas com este código. Pede um código novo.");
        }
        if (!encoder.matches(code, otpCode.getCodeHash())) {
            int count = rateLimiter.record(failures, Duration.ofMinutes(ombalaProperties.otpExpirationMinutes()));
            if (count >= OTP_FAILURES_PER_CODE) {
                log.warn("OTP bloqueado após {} tentativas para {}", count, maskPhone(phone));
                throw new IllegalArgumentException("Demasiadas tentativas com este código. Pede um código novo.");
            }
            throw new IllegalArgumentException("Código incorreto.");
        }

        otpCode.setUsedAt(OffsetDateTime.now());
        otpCodeRepository.save(otpCode);
    }

    private AuthResponse issueTokens(Profile profile) {
        String accessToken = jwtService.generateAccessToken(
                profile.getId(), profile.getRole().name());

        String rawRefresh = randomToken();

        refreshTokenRepository.save(RefreshToken.builder()
                .profile(profile)
                .tokenHash(hashToken(rawRefresh))
                .expiresAt(OffsetDateTime.now().plusDays(jwtProperties.refreshExpirationDays()))
                .build());

        return new AuthResponse(accessToken, rawRefresh, jwtService.accessTokenExpiresInSeconds());
    }

    // 256 bits, base64url sem padding
    private String randomToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static void assertPasswordLength(String password) {
        if (password != null && password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new IllegalArgumentException("A password pode ter no máximo 72 caracteres.");
        }
    }

    private String maskIdentifier(String identifier) {
        if (identifier.contains("@")) {
            int at = identifier.indexOf('@');
            return (at <= 1 ? "*" : identifier.charAt(0) + "***") + identifier.substring(at);
        }
        return maskPhone(identifier);
    }

    private String hashToken(String rawToken) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 não disponível", e);
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        return phone.substring(0, phone.length() - 6) + "***" + phone.substring(phone.length() - 3);
    }
}
