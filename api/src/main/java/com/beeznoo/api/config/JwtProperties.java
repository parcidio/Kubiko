package com.beeznoo.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;

// Sem valores por omissão no segredo: a API não arranca sem JWT_SECRET forte (OWASP A02/A04)
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        int expirationMinutes,
        int refreshExpirationDays
) {
    // HS256 exige ≥ 256 bits
    static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.isBlank() || secret.startsWith("${")) {
            throw new IllegalStateException("JWT_SECRET em falta. Gera um com: openssl rand -base64 64");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET demasiado curto (mínimo " + MIN_SECRET_BYTES + " bytes)");
        }
        if (secret.startsWith("beeznoo-super-secret")) {
            throw new IllegalStateException("JWT_SECRET é o valor de exemplo antigo, que é público. Gera um novo.");
        }
        if (expirationMinutes <= 0 || refreshExpirationDays <= 0) {
            throw new IllegalStateException("jwt.expiration-minutes e jwt.refresh-expiration-days têm de ser positivos");
        }
    }
}
