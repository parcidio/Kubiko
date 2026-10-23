package com.beeznoo.api.common.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

/**
 * Contadores no Postgres (tabela rate_limit_counters, V17) para várias instâncias da API.
 * Cada operação corre numa transação própria (REQUIRES_NEW): um login falhado faz rollback da transação
 * do pedido, mas a tentativa tem de ficar contada. As chaves (que podem ter telefones) ficam em SHA-256.
 */
public class JdbcRateLimitStore implements RateLimitStore {

    // Janela expirada → recomeça; senão soma. Atómico (ON CONFLICT) e sem SQL dinâmico.
    private static final String UPSERT = """
            INSERT INTO rate_limit_counters (key_hash, window_start, window_ms, count)
            VALUES (?, clock_timestamp(), ?, 1)
            ON CONFLICT (key_hash) DO UPDATE SET
              window_start = CASE WHEN rate_limit_counters.window_start
                                       + rate_limit_counters.window_ms * INTERVAL '1 millisecond' <= clock_timestamp()
                                  THEN clock_timestamp() ELSE rate_limit_counters.window_start END,
              count        = CASE WHEN rate_limit_counters.window_start
                                       + rate_limit_counters.window_ms * INTERVAL '1 millisecond' <= clock_timestamp()
                                  THEN 1 ELSE rate_limit_counters.count + 1 END,
              window_ms    = EXCLUDED.window_ms
            RETURNING window_start, window_ms, count""";

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public JdbcRateLimitStore(JdbcTemplate jdbc, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(transactionManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public Window increment(String key, Duration window) {
        return tx.execute(s -> jdbc.queryForObject(UPSERT, (rs, i) -> new Window(
                rs.getTimestamp("window_start").getTime(), rs.getLong("window_ms"), rs.getInt("count")),
                hash(key), window.toMillis()));
    }

    @Override
    public Window current(String key) {
        List<Window> rows = tx.execute(s -> jdbc.query(
                "SELECT window_start, window_ms, count FROM rate_limit_counters WHERE key_hash = ?",
                (rs, i) -> new Window(rs.getTimestamp("window_start").getTime(), rs.getLong("window_ms"), rs.getInt("count")),
                hash(key)));
        if (rows == null || rows.isEmpty()) return null;
        Window w = rows.getFirst();
        return w.expiredAt(System.currentTimeMillis()) ? null : w;
    }

    @Override
    public void reset(String key) {
        tx.executeWithoutResult(s -> jdbc.update("DELETE FROM rate_limit_counters WHERE key_hash = ?", hash(key)));
    }

    @Override
    public void clear() {
        tx.executeWithoutResult(s -> jdbc.update("DELETE FROM rate_limit_counters"));
    }

    @Override
    public void evictExpired() {
        tx.executeWithoutResult(s -> jdbc.update(
                "DELETE FROM rate_limit_counters WHERE window_start + window_ms * INTERVAL '1 millisecond' < ?",
                new Timestamp(System.currentTimeMillis())));
    }

    static String hash(String key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
