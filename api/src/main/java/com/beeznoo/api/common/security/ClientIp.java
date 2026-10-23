package com.beeznoo.api.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * IP do cliente para limites de pedidos. Só confia nas entradas do X-Forwarded-For acrescentadas pelos
 * `trustedProxies` proxies à frente da API — as da esquerda podem ser inventadas pelo cliente.
 * Ex.: browser → Vercel → Render → API, com trustedProxies = 2: XFF = "cliente, vercel" → "cliente".
 */
@Component
public class ClientIp {

    private final int trustedProxies;

    public ClientIp(SecurityProperties properties) {
        this.trustedProxies = Math.max(0, properties.trustedProxies());
    }

    public String of(HttpServletRequest request) {
        if (trustedProxies == 0) return request.getRemoteAddr();
        String header = request.getHeader("X-Forwarded-For");
        if (header == null || header.isBlank()) return request.getRemoteAddr();
        String[] hops = header.split(",");
        int index = Math.max(0, hops.length - trustedProxies);
        return hops[index].strip();
    }
}
