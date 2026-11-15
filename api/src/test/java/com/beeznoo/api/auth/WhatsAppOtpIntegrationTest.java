package com.beeznoo.api.auth;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.entity.OtpCode.Purpose;
import com.beeznoo.api.auth.repository.OtpCodeRepository;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.profile.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** OTP pelo WhatsApp (Losambo): a Beeznoo guarda o pedido e o propósito, o Losambo gera e valida o código. */
@SpringBootTest(properties = "otp.channel=whatsapp")
@Testcontainers
@Transactional
class WhatsAppOtpIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String PHONE = "+244923222000";
    private static final String PASSWORD = "Kizomba#Talatona-77";

    @MockitoBean OmbalaSmsService ombalaSmsService;
    @MockitoBean WhatsAppOtpClient whatsApp;

    @Autowired AuthService authService;
    @Autowired OtpCodeRepository otpCodeRepository;
    @Autowired com.beeznoo.api.common.security.RateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter.clear();
        when(whatsApp.send(anyString())).thenReturn(new WhatsAppOtpClient.OtpSent("otp_8f2c", 300));
    }

    @Test
    void registo_enviaPorWhatsApp_eValidaNoLosambo() {
        authService.register(new RegisterRequest("Ana WhatsApp", PHONE, null, PASSWORD, UserRole.RENTER));

        verify(whatsApp).send(PHONE);
        verifyNoInteractions(ombalaSmsService);
        var otp = otpCodeRepository.findLatestValid(PHONE, Purpose.REGISTRATION).orElseThrow();
        assertThat(otp.getCodeHash()).isEqualTo("losambo:otp_8f2c");

        when(whatsApp.verify("otp_8f2c", PHONE, "000000")).thenReturn(false);
        assertThatThrownBy(() -> authService.verifyRegistration(new VerifyRegistrationRequest(PHONE, "000000")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("incorreto");

        when(whatsApp.verify("otp_8f2c", PHONE, "123456")).thenReturn(true);
        assertThat(authService.verifyRegistration(new VerifyRegistrationRequest(PHONE, "123456")).accessToken()).isNotBlank();

        // uso único: o mesmo código não volta a servir
        assertThat(otpCodeRepository.findLatestValid(PHONE, Purpose.REGISTRATION)).isEmpty();
    }

    @Test
    void codigoDoRegisto_naoServeParaReporAPassword() {
        authService.register(new RegisterRequest("Bento WhatsApp", PHONE, null, PASSWORD, UserRole.RENTER));
        when(whatsApp.verify(any(), eq(PHONE), eq("123456"))).thenReturn(true);
        authService.verifyRegistration(new VerifyRegistrationRequest(PHONE, "123456"));

        // sem pedido de reposição, um código "válido" no Losambo não chega
        assertThatThrownBy(() -> authService.confirmPasswordReset(
                new PasswordResetConfirmRequest(PHONE, "123456", "Outra#Password-2026")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void numeroSemWhatsApp_semSmsConfigurado_explicaOMotivo() {
        when(whatsApp.send(anyString())).thenThrow(new WhatsAppOtpClient.NotOnWhatsAppException());
        assertThatThrownBy(() -> authService.register(new RegisterRequest("Carla", PHONE, null, PASSWORD, UserRole.RENTER)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("não tem WhatsApp");
    }

    @Test
    void losamboEmBaixo_aoValidar_daErroTemporario() {
        authService.register(new RegisterRequest("Dário", PHONE, null, PASSWORD, UserRole.RENTER));
        when(whatsApp.verify(any(), any(), any())).thenThrow(new WhatsAppOtpClient.UnavailableException("Losambo 503"));
        assertThatThrownBy(() -> authService.verifyRegistration(new VerifyRegistrationRequest(PHONE, "123456")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Tenta daqui a pouco");
    }
}
