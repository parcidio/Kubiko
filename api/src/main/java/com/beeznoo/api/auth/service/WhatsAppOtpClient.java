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
     * Válido = 2xx com veredicto positivo explícito (ver {@link #isVerified}); tudo o resto falha fechado.
     * 4xx = código errado ou expirado.
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

    // ---- Mensagens livres (Admin › Mensagens, decisoes-produto.md 2026-11-17) ----
    // ⚑ API do Losambo NÃO documentada publicamente: os dois métodos abaixo são o único sítio que conhece o formato.
    //   Se o corpo/resposta real for diferente, muda-se só aqui (confirmar na consola do Losambo).

    /**
     * POST /messages { to: "+244…", text } → 2xx. 404 not_on_whatsapp → {@link NotOnWhatsAppException};
     * outros erros → {@link UnavailableException}. Nunca escreve o número completo nem o texto nos logs.
     */
    public void sendText(String phone, String text) {
        if (!props.configured()) throw new UnavailableException("WhatsApp sem chave para o ambiente " + props.env());
        try {
            client.post().uri("/messages").body(Map.of("to", phone, "text", text)).retrieve().toBodilessEntity();
        } catch (RestClientResponseException e) {
            String error = errorCode(e);
            if (e.getStatusCode().value() == 404 && "not_on_whatsapp".equals(error)) throw new NotOnWhatsAppException();
            log.warn("Losambo recusou a mensagem para {}: {} {}", mask(phone), e.getStatusCode().value(), error);
            throw new UnavailableException("Losambo " + e.getStatusCode().value() + (error == null ? "" : " " + error));
        } catch (RuntimeException e) {
            log.warn("Falha a contactar o Losambo para enviar mensagem a {}: {}", mask(phone), e.getClass().getSimpleName());
            throw new UnavailableException("Losambo indisponível");
        }
    }

    /**
     * GET /contacts/{phone} → o número tem WhatsApp? true/false; null = não sabemos (sem chave, gateway em baixo,
     * resposta sem campo reconhecido). 404 = sem WhatsApp. A resposta é lida com tolerância: exists, numberExists,
     * onWhatsApp, hasWhatsApp, on_whatsapp ou registered (booleanos), no topo ou dentro de "data".
     */
    public Boolean hasWhatsApp(String phone) {
        if (!props.configured()) return null;
        try {
            Map<?, ?> res = client.get().uri("/contacts/{phone}", phone).retrieve().body(Map.class);
            return parseHasWhatsApp(res);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) return false;
            log.warn("Losambo falhou a verificar o contacto {}: {}", mask(phone), e.getStatusCode().value());
            return null;
        } catch (RuntimeException e) {
            log.warn("Falha a contactar o Losambo para verificar {}: {}", mask(phone), e.getClass().getSimpleName());
            return null;
        }
    }

    public static Boolean parseHasWhatsApp(Map<?, ?> res) {
        if (res == null) return null;
        for (String flag : new String[]{"hasWhatsApp", "onWhatsApp", "on_whatsapp", "numberExists", "exists", "registered"}) {
            Object v = res.get(flag);
            if (v instanceof Boolean b) return b;
            if (v instanceof String s && (s.equalsIgnoreCase("true") || s.equalsIgnoreCase("false"))) {
                return Boolean.parseBoolean(s);
            }
        }
        if (res.get("data") instanceof Map<?, ?> inner) return parseHasWhatsApp(inner);
        return null;
    }

    /**
     * Falha fechado: só um veredicto positivo explícito conta como código válido ("valid"/"verified"/"ok"/"success"
     * a true, ou "status" verificado). 2xx sem corpo, com erro ou sem veredicto reconhecido = não verificado.
     */
    static boolean isVerified(Map<?, ?> res) {
        if (res == null || res.isEmpty()) {
            log.warn("Losambo respondeu 2xx sem corpo ao validar um OTP: tratado como código inválido");
            return false;
        }
        if (res.get("error") != null) return false;
        for (String flag : new String[]{"valid", "verified", "ok", "success"}) {
            Object v = res.get(flag);
            if (v instanceof Boolean b) return b;
            if (v != null) return false; // tipo inesperado (ex. "true" em texto): não arriscar
        }
        if (res.get("status") instanceof String status) {
            String s = status.toLowerCase(java.util.Locale.ROOT);
            return s.equals("verified") || s.equals("approved") || s.equals("valid") || s.equals("ok");
        }
        log.warn("Losambo respondeu 2xx sem veredicto reconhecido ao validar um OTP (campos {}): tratado como inválido",
                res.keySet());
        return false;
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
