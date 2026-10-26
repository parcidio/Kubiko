package com.beeznoo.api.common.security;

import java.time.Duration;

// Onde vivem os contadores dos limites: memória (uma instância) ou Postgres (várias)
public interface RateLimitStore {

    record Window(long startMillis, long durationMillis, int count) {
        public boolean expiredAt(long now) {
            return now - startMillis >= durationMillis;
        }
    }

    // Conta mais um pedido na janela (abre uma nova se a anterior expirou)
    Window increment(String key, Duration window);

    // null se não existe ou já expirou
    Window current(String key);

    void reset(String key);

    void clear();

    void evictExpired();
}
