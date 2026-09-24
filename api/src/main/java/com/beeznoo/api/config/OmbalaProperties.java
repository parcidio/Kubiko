package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ombala")
public record OmbalaProperties(
        String apiUrl,
        String token,
        String sender,
        int otpExpirationMinutes
) {}
