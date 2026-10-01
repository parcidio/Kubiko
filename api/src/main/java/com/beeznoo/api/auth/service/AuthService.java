package com.beeznoo.api.auth.service;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.entity.GooglePendingSignup;
import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import com.beeznoo.api.auth.entity.RefreshToken;
import com.beeznoo.api.auth.repository.GooglePendingSignupRepository;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
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

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final OtpCodeRepository otpCodeRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ProfileRepository profileRepository;
    private final GooglePendingSignupRepository googlePendingSignupRepository;
    private final OmbalaSmsService ombalaSmsService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final OmbalaProperties ombalaProperties;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public void register(RegisterRequest request) {
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

        Profile profile = request.phone() != null
                ? profileRepository.findByPhone(request.phone())
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas."))
                : profileRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas."));

        if (!encoder.matches(request.password(), profile.getPasswordHash())) {
            throw new IllegalArgumentException("Credenciais inválidas.");
        }

        if (!profile.isVerified()) {
            throw new IllegalArgumentException("Número de Telefone ainda não verificado. Verifica o teu SMS.");
        }

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
        consumeOtp(request.phone(), request.code(), Purpose.PASSWORD_RESET);

        Profile profile = profileRepository.findByPhone(request.phone())
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado."));

        profile.setPasswordHash(encoder.encode(request.newPassword()));
        profileRepository.save(profile);

        refreshTokenRepository.revokedAllForProfile(profile.getId());

        log.info("Password redefinida para {}", maskPhone(request.phone()));
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        String hashedToken = hashToken(rawRefreshToken);
        RefreshToken token = refreshTokenRepository
                .findByTokenHash(hashedToken)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token inválido."));

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

    private void sendOtp(String phone, Purpose purpose) {
        otpCodeRepository.invalidateAllForPhone(phone, purpose);

        String code = String.valueOf(100_000 + secureRandom.nextInt(900_00));

        otpCodeRepository.save(OtpCode.builder()
                .phone(phone)
                .purpose(purpose)
                .codeHash(encoder.encode(code))
                .expiresAt(OffsetDateTime.now().plusMinutes(ombalaProperties.otpExpirationMinutes()))
                .build());

        ombalaSmsService.sendOtp(phone, code);
    }

    private void consumeOtp(String phone, String code, Purpose purpose) {
        OtpCode otpCode = otpCodeRepository.findLatestValid(phone, purpose)
                .orElseThrow(() -> new IllegalArgumentException("Código inválido ou expirado. Solicita um novo."));

        if (!encoder.matches(code, otpCode.getCodeHash())) {
            throw new IllegalArgumentException("Código incorreto.");
        }

        otpCode.setUsedAt(OffsetDateTime.now());
        otpCodeRepository.save(otpCode);
    }

    private AuthResponse issueTokens(Profile profile) {
        String accessToken = jwtService.generateAccessToken(
                profile.getId(), profile.getRole().name());

        String rawRefresh = UUID.randomUUID().toString();

        refreshTokenRepository.save(RefreshToken.builder()
                .profile(profile)
                .tokenHash(hashToken(rawRefresh))
                .expiresAt(OffsetDateTime.now().plusDays(jwtProperties.refreshExpirationDays()))
                .build());

        return new AuthResponse(accessToken, rawRefresh, jwtService.accessTokenExpiresInSeconds());
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
