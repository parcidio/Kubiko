package com.beeznoo.api.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Proteções transversais. Ver claude/decisoes-produto.md (2026-10-23, segurança).
 *
 * @param rateLimitsEnabled  desligar só em testes de carga
 * @param trustedProxies     nº de proxies à frente da API que acrescentam ao X-Forwarded-For (0 em local)
 * @param maxJsonBytes       tamanho máximo de um corpo que não seja multipart
 */
@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(boolean rateLimitsEnabled, int trustedProxies, long maxJsonBytes) {}
