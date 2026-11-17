package com.beeznoo.api.message.service;

import com.beeznoo.api.auth.service.OmbalaSmsService;
import com.beeznoo.api.auth.service.WhatsAppOtpClient;
import com.beeznoo.api.message.config.MessageProperties;
import com.beeznoo.api.message.entity.MessageChannel;
import com.beeznoo.api.notification.email.EmailTemplateRenderer;
import com.beeznoo.api.notification.email.ResendEmailSender;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Envia as mensagens da equipa depois do commit, numa thread própria (um envio de cada vez, para não competir com os
 * emails das notificações no executor @Async). WhatsApp com pausa aleatória entre mensagens ("ritmo humano" do
 * Losambo); email/SMS com pausa curta. Cada entrega fica SENT ou FAILED; o erro guarda só um motivo curto.
 * <p>
 * ⚑ Se a instância reiniciar a meio, as entregas que faltam ficam PENDING (visíveis no detalhe). Não há retoma
 * automática: com várias réplicas isso podia enviar duas vezes.
 */
@Slf4j
@Component
public class MessageDispatcher {

    private record Pending(UUID id, String name, String destination) {}

    private record Message(MessageChannel channel, String subject, String body) {}

    private final JdbcTemplate jdbc;
    private final MessageProperties props;
    private final WhatsAppOtpClient whatsApp;
    private final OmbalaSmsService sms;
    private final ResendEmailSender email;
    private final EmailTemplateRenderer renderer;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "admin-messages");
        t.setDaemon(true);
        return t;
    });

    public MessageDispatcher(JdbcTemplate jdbc, MessageProperties props, WhatsAppOtpClient whatsApp,
                             OmbalaSmsService sms, ResendEmailSender email, EmailTemplateRenderer renderer) {
        this.jdbc = jdbc;
        this.props = props;
        this.whatsApp = whatsApp;
        this.sms = sms;
        this.email = email;
        this.renderer = renderer;
    }

    @TransactionalEventListener(fallbackExecution = true)
    public void onQueued(MessageService.MessageQueued event) {
        executor.submit(() -> {
            try {
                dispatch(event.messageId());
            } catch (RuntimeException e) {
                log.warn("Mensagem {}: envio interrompido ({})", event.messageId(), e.getClass().getSimpleName());
            }
        });
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /** Envia as entregas PENDING de uma mensagem, pela ordem. Público para os testes (corre na thread de quem chama). */
    public void dispatch(UUID messageId) {
        List<Message> found = jdbc.query("SELECT channel, subject, body FROM admin_messages WHERE id = ?",
                (rs, i) -> new Message(MessageChannel.valueOf(rs.getString("channel")), rs.getString("subject"),
                        rs.getString("body")), messageId);
        if (found.isEmpty()) return;
        Message message = found.getFirst();
        List<Pending> pending = jdbc.query("""
                SELECT d.id, p.full_name, d.destination
                FROM message_deliveries d JOIN profiles p ON p.id = d.profile_id
                WHERE d.message_id = ? AND d.status = 'PENDING'
                ORDER BY d.created_at, d.id
                """, (rs, i) -> new Pending(rs.getObject("id", UUID.class), rs.getString("full_name"),
                rs.getString("destination")), messageId);

        int sent = 0;
        int failed = 0;
        for (int i = 0; i < pending.size(); i++) {
            if (Thread.currentThread().isInterrupted()) break;
            if (i > 0 && !pause(message.channel())) break;
            Pending d = pending.get(i);
            try {
                send(message, d);
                jdbc.update("UPDATE message_deliveries SET status = 'SENT', error = NULL, sent_at = ? WHERE id = ?",
                        OffsetDateTime.now(), d.id());
                sent++;
            } catch (WhatsAppOtpClient.NotOnWhatsAppException e) {
                // não é falha do envio: o número não tem WhatsApp
                jdbc.update("UPDATE message_deliveries SET status = 'SKIPPED', error = 'not_on_whatsapp' WHERE id = ?", d.id());
            } catch (RuntimeException e) {
                jdbc.update("UPDATE message_deliveries SET status = 'FAILED', error = ? WHERE id = ?",
                        shortError(e), d.id());
                failed++;
            }
        }
        jdbc.update("UPDATE admin_messages SET finished_at = ? WHERE id = ?", OffsetDateTime.now(), messageId);
        log.info("Mensagem {} ({}): {} enviadas, {} falharam", messageId, message.channel(), sent, failed);
    }

    private void send(Message message, Pending d) {
        String text = MessageText.render(message.body(), d.name());
        switch (message.channel()) {
            case WHATSAPP -> whatsApp.sendText(d.destination(), text);
            case SMS -> sms.sendText(d.destination(), text);
            case EMAIL -> {
                String subject = MessageText.singleLine(MessageText.render(message.subject(), d.name()));
                String html = renderer.render(null, subject, MessageText.paragraphs(text), null, null);
                email.send(d.destination(), subject, html, "admin-message-" + d.id());
            }
        }
    }

    /** false se a thread foi interrompida (a aplicação está a parar). */
    private boolean pause(MessageChannel channel) {
        Duration delay = channel == MessageChannel.WHATSAPP ? jitter(props.whatsappMinDelay(), props.whatsappMaxDelay())
                : props.otherDelay();
        if (delay.isZero() || delay.isNegative()) return true;
        try {
            Thread.sleep(delay);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static Duration jitter(Duration min, Duration max) {
        long lo = min.toMillis();
        long hi = max.toMillis();
        return Duration.ofMillis(hi <= lo ? lo : ThreadLocalRandom.current().nextLong(lo, hi + 1));
    }

    // só a classe e a mensagem curta do cliente (que nunca leva número, email nem texto)
    private static String shortError(RuntimeException e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return msg.length() > 200 ? msg.substring(0, 200) : msg;
    }
}
