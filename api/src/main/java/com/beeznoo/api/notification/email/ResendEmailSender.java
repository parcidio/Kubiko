package com.beeznoo.api.notification.email;

import com.beeznoo.api.notification.config.NotificationProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

/**
 * Email transaccional pela API REST do Resend (POST /emails). Sem SDK — RestClient do Spring.
 * O domínio do remetente tem de estar verificado no Resend (SPF/DKIM).
 */
@Component
public class ResendEmailSender {

    private final RestClient client;
    private final NotificationProperties.Email props;

    @Autowired
    public ResendEmailSender(NotificationProperties properties) {
        this(RestClient.builder(), properties);
    }

    // Os testes passam um builder ligado ao MockRestServiceServer
    public ResendEmailSender(RestClient.Builder builder, NotificationProperties properties) {
        this.props = properties.email();
        if (props.enabled() && (props.apiKey() == null || props.apiKey().isBlank())) {
            throw new IllegalStateException("app.notifications.email.enabled=true exige RESEND_API_KEY");
        }
        this.client = builder
                .baseUrl(props.apiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey())
                .build();
    }

    public boolean isEnabled() {
        return props.enabled();
    }

    /**
     * @param idempotencyKey o Resend ignora um segundo envio com a mesma chave (24 h)
     * @throws EmailDeliveryException com o código HTTP, sem o corpo da resposta
     */
    public void send(String to, String subject, String html, String idempotencyKey) {
        try {
            client.post()
                    .uri("/emails")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Idempotency-Key", idempotencyKey)
                    .body(Map.of("from", props.from(), "to", List.of(to), "subject", subject, "html", html))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new EmailDeliveryException("HTTP " + e.getStatusCode().value(), e);
        } catch (RuntimeException e) {
            throw new EmailDeliveryException(e.getClass().getSimpleName(), e);
        }
    }

    public static class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
