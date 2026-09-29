package com.beeznoo.api.auth;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.entity.OtpCode;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.repository.RefreshTokenRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;

@SpringBootTest
@Testcontainers
@Transactional
class AuthServiceIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @MockitoBean OmbalaSmsService ombalaSmsService;

    @Autowired AuthService authService;
    @Autowired OtpCodeRepository otpCodeRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired ProfileRepository profileRepository;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private static final String PHONE    = "+244923111000";
    private static final String PASSWORD = "password123";

    @BeforeEach
    void setUp() {
        doNothing().when(ombalaSmsService).sendOtp(anyString(), anyString());
    }

    // ---- Helpers ----

    private void doRegister() {
        authService.register(new RegisterRequest(
                "Leonel Teste", PHONE, null, PASSWORD, UserRole.RENTER));
    }

    private void doVerify() {
        OtpCode otp = otpCodeRepository.findLatestValid(PHONE, Purpose.REGISTRATION)
                .orElseThrow(() -> new IllegalArgumentException("OTP não encontrado"));
        String code = "123456";
        otp.setCodeHash(encoder.encode(code));
        otpCodeRepository.save(otp);
        authService.verifyRegistration(new VerifyRegistrationRequest(PHONE, code));
    }

    private OtpCode getLatestOtp(String phone, Purpose purpose) {
        return otpCodeRepository.findLatestValid(phone, purpose)
                .orElseThrow(() -> new IllegalArgumentException("OTP não encontrado"));
    }

    // ---- Testes ----

    @Test
    @DisplayName("Registo passo 1 — perfil criado como não verificado")
    void registerCreatesUnverifiedProfile() {
        doRegister();

        Optional<Profile> profile = profileRepository.findByPhone(PHONE);
        assertThat(profile).isPresent();
        assertThat(profile.get().isVerified()).isFalse();

        Optional<OtpCode> otp = otpCodeRepository.findLatestValid(PHONE, Purpose.REGISTRATION);
        assertThat(otp).isPresent();
    }

    @Test
    @DisplayName("Registo passo 2 — perfil verificado e tokens emitidos")
    void verifyRegistrationActivatesProfileAndIssuesTokens() {
        doRegister();

        String code = "654321";
        OtpCode otp = getLatestOtp(PHONE, Purpose.REGISTRATION);
        otp.setCodeHash(encoder.encode(code));
        otpCodeRepository.save(otp);

        AuthResponse response = authService.verifyRegistration(
                new VerifyRegistrationRequest(PHONE, code));

        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.refreshToken()).isNotBlank();

        Optional<Profile> profile = profileRepository.findByPhone(PHONE);
        assertThat(profile).isPresent();
        assertThat(profile.get().isVerified()).isTrue();
    }

    @Test
    @DisplayName("Login com telefone + password correctos")
    void loginWithPhoneAndPassword() {
        doRegister();
        doVerify();

        AuthResponse response = authService.login(new LoginRequest(PHONE, null, PASSWORD));
        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.expiresIn()).isPositive();
    }

    @Test
    @DisplayName("Login com email + password correctos")
    void loginWithEmailAndPassword() {
        authService.register(new RegisterRequest(
                "Leonel Email", PHONE, "leonel@beeznoo.com", PASSWORD, UserRole.RENTER));
        doVerify();

        AuthResponse response = authService.login(
                new LoginRequest(null, "leonel@beeznoo.com", PASSWORD));
        assertThat(response.accessToken()).isNotBlank();
    }

    @Test
    @DisplayName("Login com password errada lança excepção")
    void loginWithWrongPasswordThrows() {
        doRegister();
        doVerify();

        assertThatThrownBy(() -> authService.login(new LoginRequest(PHONE, null, "errada")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Credenciais inválidas");
    }

    @Test
    @DisplayName("Login sem verificação lança excepção")
    void loginWithUnverifiedProfileThrows() {
        doRegister(); // sem doVerify()

        assertThatThrownBy(() -> authService.login(new LoginRequest(PHONE, null, PASSWORD)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("não verificado");
    }

    @Test
    @DisplayName("Recuperação de password — nova password funciona no login")
    void passwordResetAllowsLoginWithNewPassword() {
        doRegister();
        doVerify();

        authService.requestPassword(new PasswordResetRequest(PHONE));

        String code = "999888";
        OtpCode otp = getLatestOtp(PHONE, Purpose.PASSWORD_RESET);
        otp.setCodeHash(encoder.encode(code));
        otpCodeRepository.save(otp);

        authService.confirmPasswordReset(
                new PasswordResetConfirmRequest(PHONE, code, "newPassword123"));

        AuthResponse response = authService.login(
                new LoginRequest(PHONE, null, "newPassword123"));
        assertThat(response.accessToken()).isNotBlank();
    }

    @Test
    @DisplayName("Refresh rota tokens e revoga o antigo")
    void refreshRotatesTokens() {
        doRegister();
        doVerify();

        AuthResponse first = authService.login(new LoginRequest(PHONE, null, PASSWORD));
        AuthResponse second = authService.refresh(first.refreshToken());

        assertThat(second.accessToken()).isNotBlank();
        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
    }

    @Test
    @DisplayName("Logout revoga todos os refresh tokens")
    void logoutRevokesAllTokens() {
        doRegister();
        doVerify();

        authService.login(new LoginRequest(PHONE, null, PASSWORD));

        Optional<Profile> profileOpt = profileRepository.findByPhone(PHONE);
        assertThat(profileOpt).isPresent();
        authService.logout(profileOpt.get().getId());

        long active = refreshTokenRepository.findAll().stream()
                .filter(t -> t.getProfile().getId().equals(profileOpt.get().getId())
                        && t.isValid())
                .count();
        assertThat(active).isZero();
    }
}