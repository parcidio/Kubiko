package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Canal dos códigos OTP: "whatsapp", "sms" ou "auto" (WhatsApp se houver chave do Losambo, senão SMS).
 * Ver claude/decisoes-produto.md (2026-11-15).
 */
@ConfigurationProperties(prefix = "otp")
public record OtpProperties(String channel) {

    public OtpProperties {
        if (channel == null || channel.isBlank()) channel = "auto";
        if (!channel.equals("auto") && !channel.equals("whatsapp") && !channel.equals("sms")) {
            throw new IllegalArgumentException("OTP_CHANNEL tem de ser auto, whatsapp ou sms");
        }
    }
}
