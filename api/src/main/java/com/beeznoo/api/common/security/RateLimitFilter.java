package com.beeznoo.api.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * Limites por IP e por pessoa, e tamanho máximo dos corpos JSON. Corre dentro da cadeia do Spring Security,
 * depois do filtro JWT (para saber quem é). Os limites por telefone/email ficam no AuthService.
 * Valores em claude/decisoes-produto.md (2026-10-23, segurança).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String AUTH = "/api/v1/auth/";
    private static final Set<String> OTP_SENDERS = Set.of(
            AUTH + "register", AUTH + "password/reset/request", AUTH + "google/register");

    private final RateLimiter limiter;
    private final ClientIp clientIp;
    private final SecurityProperties properties;

    public RateLimitFilter(RateLimiter limiter, ClientIp clientIp, SecurityProperties properties) {
        this.limiter = limiter;
        this.clientIp = clientIp;
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (isOversizedJson(request)) {
            reject(response, HttpStatus.CONTENT_TOO_LARGE, "Pedido demasiado grande.", 0);
            return;
        }
        try {
            applyLimits(request);
        } catch (RateLimitExceededException e) {
            reject(response, HttpStatus.TOO_MANY_REQUESTS, e.getMessage(), e.retryAfterSeconds());
            return;
        }
        chain.doFilter(request, response);
    }

    private void applyLimits(HttpServletRequest request) {
        String ip = clientIp.of(request);
        String path = request.getRequestURI();
        boolean write = !HttpMethod.GET.matches(request.getMethod()) && !HttpMethod.HEAD.matches(request.getMethod())
                && !HttpMethod.OPTIONS.matches(request.getMethod());

        limiter.check("ip:" + ip, 300, Duration.ofMinutes(1), "Demasiados pedidos. Espera um pouco.");

        if (write && (path.equals(AUTH + "login") || path.equals(AUTH + "login/mfa"))) {
            limiter.check("login-ip:" + ip, 30, Duration.ofMinutes(15), "Demasiadas tentativas de entrar. Tenta mais tarde.");
        } else if (write && OTP_SENDERS.contains(path)) {
            limiter.check("otp-ip:" + ip, 10, Duration.ofHours(1), "Pediste demasiados códigos. Tenta daqui a uma hora.");
        } else if (write && path.equals(AUTH + "refresh")) {
            limiter.check("refresh-ip:" + ip, 30, Duration.ofMinutes(1), "Demasiados pedidos. Espera um pouco.");
        } else if (write && path.equals(AUTH + "google/exchange")) {
            limiter.check("exchange-ip:" + ip, 20, Duration.ofMinutes(1), "Demasiados pedidos. Espera um pouco.");
        }

        UUID profileId = currentProfile();
        if (profileId != null && write) {
            if (isMultipart(request)) {
                limiter.check("upload:" + profileId, 30, Duration.ofHours(1), "Enviaste demasiados ficheiros. Tenta mais tarde.");
            }
            limiter.check("write:" + profileId, 120, Duration.ofMinutes(1), "Demasiados pedidos. Espera um pouco.");
        }
    }

    private boolean isOversizedJson(HttpServletRequest request) {
        return !isMultipart(request) && request.getContentLengthLong() > properties.maxJsonBytes();
    }

    private static boolean isMultipart(HttpServletRequest request) {
        String type = request.getContentType();
        return type != null && type.toLowerCase().startsWith(MediaType.MULTIPART_FORM_DATA_VALUE);
    }

    private static UUID currentProfile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UUID id ? id : null;
    }

    private static void reject(HttpServletResponse response, HttpStatus status, String message, long retryAfter)
            throws IOException {
        response.setStatus(status.value());
        if (retryAfter > 0) response.setHeader("Retry-After", Long.toString(retryAfter));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"status\":" + status.value() + ",\"message\":\"" + message + "\"}");
    }
}
