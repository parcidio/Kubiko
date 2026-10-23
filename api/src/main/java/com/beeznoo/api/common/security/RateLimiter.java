package com.beeznoo.api.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitador de janela fixa em memória (por instância). Chega para uma instância no Render;
 * com várias instâncias, passar para Redis. As chaves nunca entram nos logs (podem ter telefones).
 */
@Slf4j
@Component
public class RateLimiter {

    private record Window(long startMillis, long durationMillis, int count) {
        boolean expiredAt(long now) {
            return now - startMillis >= durationMillis;
        }
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final SecurityProperties properties;

    public RateLimiter(SecurityProperties properties) {
        this.properties = properties;
    }

    // Conta esta tentativa; lança 429 se passar o limite da janela
    public void check(String key, int limit, Duration window, String message) {
        if (!properties.rateLimitsEnabled()) return;
        Window w = increment(key, window);
        if (w.count() > limit) {
            long retryAfter = Math.max(1, (w.startMillis() + w.durationMillis() - System.currentTimeMillis()) / 1000);
            log.warn("Limite atingido ({}): {} pedidos em {} s", category(key), w.count(), window.toSeconds());
            throw new RateLimitExceededException(message, retryAfter);
        }
    }

    // Só conta (ex.: tentativa falhada de OTP), sem lançar
    public int record(String key, Duration window) {
        if (!properties.rateLimitsEnabled()) return 0;
        return increment(key, window).count();
    }

    // Já passou o limite? Não conta.
    public boolean isExceeded(String key, int limit) {
        if (!properties.rateLimitsEnabled()) return false;
        Window w = windows.get(key);
        return w != null && !w.expiredAt(System.currentTimeMillis()) && w.count() >= limit;
    }

    public void reset(String key) {
        windows.remove(key);
    }

    // Só para testes
    public void clear() {
        windows.clear();
    }

    @Scheduled(fixedDelay = 300_000)
    void evictExpired() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> e.getValue().expiredAt(now));
    }

    private Window increment(String key, Duration window) {
        long now = System.currentTimeMillis();
        return windows.compute(key, (k, w) -> w == null || w.expiredAt(now)
                ? new Window(now, window.toMillis(), 1)
                : new Window(w.startMillis(), w.durationMillis(), w.count() + 1));
    }

    // "login-id:+2449..." → "login-id" — o resto da chave pode ser dado pessoal
    private static String category(String key) {
        int i = key.indexOf(':');
        return i < 0 ? key : key.substring(0, i);
    }
}
