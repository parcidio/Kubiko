package com.beeznoo.api.auth.service;

import com.beeznoo.api.auth.dto.AuthResponse;
import com.beeznoo.api.auth.dto.VerifyOptRequest;
import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.RefreshToken;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.config.JwtProperties;
import com.beeznoo.api.config.WhatsAppProperties;
import com.beeznoo.api.profile.dto.CreateProfileRequest;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.service.ProfileService;
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

    private final OtpCodeRepository otpCodeRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ProfileService profileService;
    private final WhatsAppOtpService whatsAppOtpService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final WhatsAppProperties whatsAppProperties;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public void sendOtp(String phone) {

        otpCodeRepository.invalidateAllForPhone(phone);

        String code = generateOtpCode();

        OtpCode otpCode = OtpCode.builder()
                .phone(phone)
                .codeHash(encoder.encode(code))
                .expiresAt(OffsetDateTime.now().plusMinutes(whatsAppProperties.otpExpirationMinutes()))
                .build();

        otpCodeRepository.save(otpCode);

        whatsAppOtpService.sendOtp(phone, code);
    }

    @Transactional
    public AuthResponse verifyOtp(VerifyOptRequest request) {

        OtpCode otpCode = otpCodeRepository
                .findLatestValidByPhone(request.phone())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Código inválido ou expirado. Solicita um novo código."
                ));

        if (!encoder.matches(request.code(), otpCode.getCodeHash())) {
            throw new IllegalArgumentException("Código incorreto.");
        }

        otpCode.setUsedAt(OffsetDateTime.now());
        otpCodeRepository.save(otpCode);

        Profile profile = profileService.findByPhone(request.phone())
                .orElseGet(() -> profileService.createProfile(
                        new CreateProfileRequest(
                                request.phone(),
                                request.fullName(),
                                request.email(),
                                request.role()
                        )
                ));
        return issueTokens(profile);
    }

    @Transactional
    public AuthResponse refreshToken(String rawRefreshToken) {

        String tokenHash = encoder.encode(rawRefreshToken);

        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Refresh token inválido"));

        if (!refreshToken.isValid()) {
            throw new IllegalArgumentException("Refresh token expirado ou revogado");
        }

        refreshToken.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(refreshToken);

        return issueTokens(refreshToken.getProfile());
    }

    @Transactional
    public void logout(UUID profileId) {
        refreshTokenRepository.revokedAllForProfile(profileId);
        log.info("Logout: todos os refresh tokens revogados para o perfil {}" ,profileId);
    }

    private AuthResponse issueTokens(Profile profile) {

        String accessToken = jwtService.generateAccessToken(profile.getId(), profile.getRole().name());

        String rawRefreshToken = UUID.randomUUID().toString();

        refreshTokenRepository.save(RefreshToken.builder()
                .profile(profile)
                .tokenHash(encoder.encode(rawRefreshToken))
                .expiresAt(OffsetDateTime.now().plusDays(jwtProperties.refreshExpirationDays()))
                .build()
        );

        return new AuthResponse(
                accessToken,
                rawRefreshToken,
                jwtService.accessTokenExpiresInSeconds()
        );
    }

    private String generateOtpCode() {
        int code = 100_000 + secureRandom.nextInt(900_000);
        return String.valueOf(code);
    }
}
