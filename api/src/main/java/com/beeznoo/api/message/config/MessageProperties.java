package com.beeznoo.api.message.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Mensagens da equipa (Admin › Mensagens, decisoes-produto.md 2026-11-17).
 *
 * @param whatsappMinDelay   pausa mínima entre mensagens de WhatsApp ("ritmo humano" do Losambo)
 * @param whatsappMaxDelay   pausa máxima (a pausa real é aleatória entre as duas)
 * @param otherDelay         pausa entre emails/SMS (o Resend aceita ~2 pedidos/s)
 * @param maxRecipients      destinatários por envio
 * @param maxWhatsappRecipients destinatários por envio no WhatsApp (custo e risco de bloqueio do número)
 * @param whatsappHourlyCap  mensagens de WhatsApp por admin por hora (contadas em message_deliveries; custam dinheiro)
 */
@ConfigurationProperties(prefix = "app.messages")
public record MessageProperties(Duration whatsappMinDelay, Duration whatsappMaxDelay, Duration otherDelay,
                                Integer maxRecipients, Integer maxWhatsappRecipients, Integer whatsappHourlyCap) {

    public MessageProperties {
        if (whatsappMinDelay == null) whatsappMinDelay = Duration.ofSeconds(2);
        if (whatsappMaxDelay == null) whatsappMaxDelay = Duration.ofSeconds(4);
        if (whatsappMaxDelay.compareTo(whatsappMinDelay) < 0) whatsappMaxDelay = whatsappMinDelay;
        if (otherDelay == null) otherDelay = Duration.ofMillis(600);
        if (maxRecipients == null || maxRecipients <= 0) maxRecipients = 2000;
        if (maxWhatsappRecipients == null || maxWhatsappRecipients <= 0) maxWhatsappRecipients = 300;
        if (whatsappHourlyCap == null || whatsappHourlyCap <= 0) whatsappHourlyCap = 500;
    }
}
