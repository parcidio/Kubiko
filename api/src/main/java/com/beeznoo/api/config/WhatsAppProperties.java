package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "whatsapp")
public record WhatsAppProperties(
        String apiUrl,
        String phoneNumberId,
        String businessAccountId,
        String token,
        String otpTemplateName,
        int otpExpirationMinutes
) {}
