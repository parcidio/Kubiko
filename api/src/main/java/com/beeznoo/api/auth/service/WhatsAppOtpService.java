package com.beeznoo.api.auth.service;

import com.beeznoo.api.config.WhatsAppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppOtpService {

    private final RestClient whatsAppRestClient;
    private final WhatsAppProperties props;

    public void sendOtp(String phone, String code) {
        if (isDummyConfig()) {
            log.info("[SIMULATED WHATSAPP OTP] OTP enviado com sucesso (MODO SIMULAÇÃO) para {}: CÓDIGO = {}", maskPhone(phone), code);
            return;
        }

        Map<String, Object> body = Map.of(
                "messaging_product", "whatsapp",
                "to", phone,
                "type", "template",
                "template", Map.of(
                        "name", props.otpTemplateName(),
                        "language", Map.of("code", "pt_PT"),
                        "components", List.of(
                                Map.of(
                                        "type", "body",
                                        "parameters", List.of(
                                                Map.of("type", "text", "text", code)
                                        )
                                ),
                                Map.of(
                                        "type", "button",
                                        "sub_type", "url",
                                        "index", "0",
                                        "parameters", List.of(
                                                Map.of("type", "text", "text", code)
                                        )
                                )
                        )
                )
        );

        try {
            whatsAppRestClient
                    .post()
                    .uri("/{phoneNumberId}/messages", props.phoneNumberId())
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("OTP enviado para {}", maskPhone(phone));
        } catch (Exception e) {
        //     log.error("Falha ao enviar OTP para {}: {}", maskPhone(phone), e.getMessage());
        //     throw new RuntimeException("Não foi possível enviar o código de verificação. Tenta novamente.");
            log.error("Falha ao enviar OTP real para {}: {}. Usando fallback nos logs. CÓDIGO = {}", maskPhone(phone), e.getMessage(), code);
        }
    }

    private boolean isDummyConfig() {
        return props.phoneNumberId() == null || props.phoneNumberId().isBlank() || "teste".equalsIgnoreCase(props.phoneNumberId())
                || props.token() == null || props.token().isBlank() || "teste".equalsIgnoreCase(props.token());
    }

    // Mascara o número nos logs: +244923***456
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        return phone.substring(0, phone.length() - 6) + "***" + phone.substring(phone.length() - 3);
    }
}