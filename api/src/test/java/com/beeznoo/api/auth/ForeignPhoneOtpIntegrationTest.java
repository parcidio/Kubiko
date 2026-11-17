package com.beeznoo.api.auth;

import com.beeznoo.api.auth.dto.AuthDtos.RegisterRequest;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Estrangeiros residentes (decisoes-produto.md 2026-11-17, decisão 3): número internacional aceite; o OTP vai só por
 * WhatsApp, mesmo com OTP_CHANNEL=sms. Números +244 continuam como antes.
 */
@SpringBootTest(properties = "otp.channel=sms")
@Testcontainers
@Transactional
class ForeignPhoneOtpIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String PASSWORD = "Kizomba#Talatona-77";
    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @MockitoBean OmbalaSmsService ombalaSmsService;
    @MockitoBean WhatsAppOtpClient whatsApp;

    @Autowired AuthService authService;
    @Autowired RateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter.clear();
        when(whatsApp.configured()).thenReturn(true);
        when(whatsApp.send(anyString())).thenReturn(new WhatsAppOtpClient.OtpSent("otp_1", 300));
    }

    @Test
    void formatoDoTelefone_angolanoOuInternacional() {
        assertThat(valid("+244923111222")).isTrue();
        assertThat(valid("+351912345678")).isTrue();
        assertThat(valid("+14155550123")).isTrue();
        assertThat(valid("+24492311122")).isFalse();     // +244 com 8 dígitos
        assertThat(valid("+2449231112223")).isFalse();   // +244 com 10 dígitos
        assertThat(valid("923111222")).isFalse();        // sem indicativo
        assertThat(valid("+0123456789")).isFalse();
        assertThat(valid("+1234567")).isFalse();         // 7 dígitos
        assertThat(valid("+1234567890123456")).isFalse(); // 16 dígitos
    }

    @Test
    void estrangeiro_otpSoPorWhatsApp_mesmoComCanalSms() {
        authService.register(new RegisterRequest("John Smith", "+351912345678", null, PASSWORD, UserRole.RENTER));
        verify(whatsApp).send("+351912345678");
        verifyNoInteractions(ombalaSmsService);
    }

    @Test
    void angolano_comCanalSms_continuaPorSms() {
        authService.register(new RegisterRequest("Ana Domingos", "+244923111999", null, PASSWORD, UserRole.RENTER));
        verify(ombalaSmsService).sendOtp(eq("+244923111999"), anyString());
        verify(whatsApp, never()).send(anyString());
    }

    @Test
    void estrangeiro_semWhatsAppConfigurado_503() {
        when(whatsApp.configured()).thenReturn(false);
        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("Marie Curie", "+33612345678", null, PASSWORD, UserRole.RENTER)))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(e.code()).isEqualTo("whatsapp_unavailable");
                });
        verifyNoInteractions(ombalaSmsService);
    }

    @Test
    void estrangeiro_semWhatsApp_naoCaiParaSms() {
        when(whatsApp.send(anyString())).thenThrow(new WhatsAppOtpClient.NotOnWhatsAppException());
        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("Hans Müller", "+4915112345678", null, PASSWORD, UserRole.RENTER)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("not_on_whatsapp"));

        doThrow(new WhatsAppOtpClient.UnavailableException("Losambo 503")).when(whatsApp).send(anyString());
        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("Hans Müller", "+4915112345679", null, PASSWORD, UserRole.RENTER)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("whatsapp_unavailable"));
        verifyNoInteractions(ombalaSmsService);
    }

    private static boolean valid(String phone) {
        return VALIDATOR.validateProperty(new RegisterRequest("X", phone, null, PASSWORD, UserRole.RENTER), "phone").isEmpty();
    }
}
