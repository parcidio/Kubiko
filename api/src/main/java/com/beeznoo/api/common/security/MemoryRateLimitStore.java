package com.beeznoo.api.common.security;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Por instância. Chega para uma instância no Render.
public class MemoryRateLimitStore implements RateLimitStore {

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    public Window increment(String key, Duration window) {
        long now = System.currentTimeMillis();
        return windows.compute(key, (k, w) -> w == null || w.expiredAt(now)
                ? new Window(now, window.toMillis(), 1)
                : new Window(w.startMillis(), w.durationMillis(), w.count() + 1));
    }

    @Override
    public Window current(String key) {
        Window w = windows.get(key);
        return w == null || w.expiredAt(System.currentTimeMillis()) ? null : w;
    }

    @Override
    public void reset(String key) {
        windows.remove(key);
    }

    @Override
    public void clear() {
        windows.clear();
    }

    @Override
    public void evictExpired() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> e.getValue().expiredAt(now));
    }
}
