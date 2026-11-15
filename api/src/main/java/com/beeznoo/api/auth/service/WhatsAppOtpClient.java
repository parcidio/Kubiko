package com.beeznoo.api.auth.service;

import com.beeznoo.api.config.WhatsAppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Códigos OTP por WhatsApp através do Losambo (gateway da equipa sobre o WAHA). O Losambo gera o código de 6 dígitos,
 * confirma que o número tem WhatsApp, envia e valida. Ver claude/decisoes-produto.md (2026-11-15).
 * <p>
 * Nunca escreve o número completo nem o código nos logs (CLAUDE.md §6).
 */
@Slf4j
@Service
public class WhatsAppOtpClient {

    /** Resposta do envio: referência do pedido no Losambo e validade em segundos. */
    public record OtpSent(String id, long expiresInSeconds) {}

    /** O destinatário não tem WhatsApp (404 not_on_whatsapp). */
    public static class NotOnWhatsAppException extends RuntimeException {
        public NotOnWhatsAppException() {
            super("Este número não tem WhatsApp");
        }
    }

    /** O gateway não consegue enviar agora (número desligado, sem quota, subscrição, rede, sem chave). */
    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String reason) {
            super(reason);
        }
    }

    private final RestClient client;
    private final WhatsAppProperties props;

    public WhatsAppOtpClient(@Qualifier("whatsAppRestClient") RestClient client, WhatsAppProperties props) {
        this.client = client;
        this.props = props;
    }

    public boolean configured() {
        return props.configured();
    }

    /** POST /otp/send { to, app } → 202 { id, status, via, expires_in } */
    public OtpSent send(String phone) {
        if (!props.configured()) throw new UnavailableException("WhatsApp sem chave para o ambiente " + props.env());
        try {
            Map<?, ?> res = client.post()
                    .uri("/otp/send")
                    .body(Map.of("to", phone, "app", props.appName()))
                    .retrieve()
                    .body(Map.class);
            String id = text(res, "id");
            long ttl = res != null && res.get("expires_in") instanceof Number n ? n.longValue() : 300;
            log.info("OTP enviado por WhatsApp para {} (pedido {})", mask(phone), id);
            return new OtpSent(id, ttl);
        } catch (RestClientResponseException e) {
            String error = errorCode(e);
            if (e.getStatusCode().value() == 404 && "not_on_whatsapp".equals(error)) throw new NotOnWhatsAppException();
            log.warn("Losambo recusou o envio do OTP para {}: {} {}", mask(phone), e.getStatusCode().value(), error);
            throw new UnavailableException("Losambo " + e.getStatusCode().value() + " " + error);
        } catch (RuntimeException e) {
            log.warn("Falha a contactar o Losambo para enviar o OTP a {}: {}", mask(phone), e.getMessage());
            throw new UnavailableException("Losambo indisponível");
        }
    }

    /**
     * POST /otp/verify. O corpo não está na documentação pública: enviamos a referência do pedido, o número e o código.
     * Válido = 2xx sem "valid"/"verified" a false e sem estado diferente de verificado. 4xx = código errado ou expirado.
     */
    public boolean verify(String requestId, String phone, String code) {
        if (!props.configured()) throw new UnavailableException("WhatsApp sem chave para o ambiente " + props.env());
        Map<String, String> body = new LinkedHashMap<>();
        if (requestId != null) body.put("id", requestId);
        body.put("to", phone);
        body.put("code", code);
        try {
            Map<?, ?> res = client.post().uri("/otp/verify").body(body).retrieve().body(Map.class);
            return isVerified(res);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status >= 400 && status < 500 && status != 401 && status != 402 && status != 429) {
                return false; // código errado, expirado ou já usado
            }
            log.warn("Losambo falhou a validar o OTP de {}: {} {}", mask(phone), status, errorCode(e));
            throw new UnavailableException("Losambo " + status);
        } catch (RuntimeException e) {
            log.warn("Falha a contactar o Losambo para validar o OTP de {}: {}", mask(phone), e.getMessage());
            throw new UnavailableException("Losambo indisponível");
        }
    }

    static boolean isVerified(Map<?, ?> res) {
        if (res == null || res.isEmpty()) return true; // 2xx sem corpo
        for (String flag : new String[]{"valid", "verified", "ok", "success"}) {
            if (res.get(flag) instanceof Boolean b) return b;
        }
        if (res.get("status") != null) {
            String s = res.get("status").toString().toLowerCase();
            return s.equals("verified") || s.equals("approved") || s.equals("valid") || s.equals("ok");
        }
        return true;
    }

    private static String errorCode(RestClientResponseException e) {
        try {
            return text(e.getResponseBodyAs(Map.class), "error");
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String text(Map<?, ?> map, String field) {
        return map != null && map.get(field) != null ? map.get(field).toString() : null;
    }

    private static String mask(String phone) {
        if (phone == null || phone.length() < 6) return "***";
        return phone.substring(0, phone.length() - 6) + "***" + phone.substring(phone.length() - 3);
    }
}
