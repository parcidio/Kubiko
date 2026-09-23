package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        int expirationMinutes,
        int refreshExpirationDays
) {}

