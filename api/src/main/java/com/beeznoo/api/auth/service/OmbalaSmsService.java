package com.beeznoo.api.auth.service;

import com.beeznoo.api.config.OmbalaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OmbalaSmsService {

    private final RestClient ombalaRestClient;
    private final OmbalaProperties props;

    public void sendOtp(String phone, String code) {
        String normalizedPhone = normalizePhone(phone);
        String message = String.format(
                "O teu código Beeznoo é *%s*. Válido por %d minutos. Não partilhes este código.",
                code, props.otpExpirationMinutes()
        );

        Map<String, String> body = Map.of(
                "message", message,
                "from", props.sender(),
                "to", normalizedPhone
        );

        try {
            ombalaRestClient
                    .post()
                    .uri("/messages")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("OTP enviado via Ombala para {}", maskPhone(phone));
        } catch (Exception e) {
            // Nunca e.getMessage(): numa resposta de erro traz o corpo, que pode repetir a mensagem com o código OTP
            log.error("Falha ao enviar OTP via Ombala para {}: {}", maskPhone(phone), describe(e));
            throw new RuntimeException("Não foi possível enviar o código de verificação. Tenta novamente.");
        }
    }

    private static String describe(Exception e) {
        return e instanceof org.springframework.web.client.RestClientResponseException r
                ? "HTTP " + r.getStatusCode().value()
                : e.getClass().getSimpleName();
    }

    private String normalizePhone(String phone) {
        if (phone.startsWith("+244")) {
            return phone.substring(4);
        }
        if (phone.startsWith("244")) {
            return phone.substring(3);
        }
        return phone;
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        return phone.substring(0, phone.length() - 6) + "***" + phone.substring(phone.length() - 3);
    }
}