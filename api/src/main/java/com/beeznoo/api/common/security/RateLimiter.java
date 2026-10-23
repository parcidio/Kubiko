package com.beeznoo.api.common.security;

import lombok.extern.slf4j.Slf4j;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.service.SecurityEventService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Duration;
import java.util.Map;

/**
 * Limitador de janela fixa. Contadores em memória (uma instância) ou no Postgres (RATE_LIMIT_STORE=database).
 * As chaves nunca entram nos logs (podem ter telefones).
 */
@Slf4j
@Component
public class RateLimiter {

    private final RateLimitStore store;
    private final SecurityProperties properties;
    // ObjectProvider: o registo de eventos é opcional e não cria dependência circular no arranque
    private final ObjectProvider<SecurityEventService> securityEvents;

    public RateLimiter(SecurityProperties properties, JdbcTemplate jdbc, PlatformTransactionManager transactionManager,
                       ObjectProvider<SecurityEventService> securityEvents) {
        this.properties = properties;
        this.securityEvents = securityEvents;
        this.store = properties.useDatabaseStore()
                ? new JdbcRateLimitStore(jdbc, transactionManager)
                : new MemoryRateLimitStore();
    }

    // Conta esta tentativa; lança 429 se passar o limite da janela
    public void check(String key, int limit, Duration window, String message) {
        if (!properties.rateLimitsEnabled()) return;
        RateLimitStore.Window w = store.increment(key, window);
        if (w.count() > limit) {
            long retryAfter = Math.max(1, (w.startMillis() + w.durationMillis() - System.currentTimeMillis()) / 1000);
            if (w.count() == limit + 1) {
                log.warn("Limite atingido ({}): {} pedidos em {} s", category(key), w.count(), window.toSeconds());
                // uma vez por janela; a chave fica só em hash (pode ter um telefone)
                securityEvents.ifAvailable(s -> s.record(SecurityEventType.RATE_LIMITED, null, key,
                        Map.of("limit", category(key), "windowSeconds", window.toSeconds())));
            }
            throw new RateLimitExceededException(message, retryAfter);
        }
    }

    // Só conta (ex.: tentativa falhada de OTP), sem lançar
    public int record(String key, Duration window) {
        if (!properties.rateLimitsEnabled()) return 0;
        return store.increment(key, window).count();
    }

    // Já passou o limite? Não conta.
    public boolean isExceeded(String key, int limit) {
        if (!properties.rateLimitsEnabled()) return false;
        RateLimitStore.Window w = store.current(key);
        return w != null && w.count() >= limit;
    }

    public void reset(String key) {
        store.reset(key);
    }

    // Só para testes
    public void clear() {
        store.clear();
    }

    @Scheduled(fixedDelay = 300_000)
    void evictExpired() {
        store.evictExpired();
    }

    // "login-id:+2449..." → "login-id" — o resto da chave pode ser dado pessoal
    static String category(String key) {
        int i = key.indexOf(':');
        return i < 0 ? key : key.substring(0, i);
    }
}
