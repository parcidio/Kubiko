package com.beeznoo.api.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Proteções transversais. Ver claude/decisoes-produto.md (2026-10-23, segurança) e docs/SEGURANCA.md.
 *
 * @param rateLimitsEnabled  desligar só em testes de carga
 * @param rateLimitStore     "memory" (uma instância) ou "database" (várias instâncias, contadores no Postgres)
 * @param trustedProxies     nº de proxies à frente da API que acrescentam ao X-Forwarded-For (0 em local)
 * @param maxJsonBytes       tamanho máximo de um corpo que não seja multipart
 * @param adminMfaEnabled    2FA por SMS no login de contas ADMIN
 * @param cookieSecure       cookies com Secure (false só em http://localhost)
 */
@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(boolean rateLimitsEnabled, String rateLimitStore, int trustedProxies,
                                 long maxJsonBytes, boolean adminMfaEnabled, boolean cookieSecure) {

    public boolean useDatabaseStore() {
        return "database".equalsIgnoreCase(rateLimitStore);
    }
}
