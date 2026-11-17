package com.beeznoo.api.geo.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Retenção do histórico de localizações: no máximo 12 meses (PM, 2026-11-17). Uma vez por dia, um só DELETE.
 * Só corre na réplica com `app.scheduler.enabled=true` (omissão: true).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class LocationRetentionScheduler {

    static final String RETENTION = "12 months";

    private final JdbcTemplate jdbc;

    // 03:30 em Luanda, fora das horas de uso
    @Scheduled(cron = "0 30 3 * * *", zone = "Africa/Luanda")
    @Transactional
    public int purgeOld() {
        int deleted = jdbc.update(
                "DELETE FROM location_events WHERE created_at < now() - interval '" + RETENTION + "'");
        if (deleted > 0) log.info("Retenção: {} localizações com mais de 12 meses apagadas", deleted);
        return deleted;
    }
}
