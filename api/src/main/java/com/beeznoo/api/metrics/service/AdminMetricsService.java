package com.beeznoo.api.metrics.service;

import com.beeznoo.api.metrics.dto.MetricsDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Métricas do painel do admin, calculadas na hora com SQL agregado (decisoes-produto.md 2026-11-15).
 * Só leitura; nada de dados pessoais na resposta. Meses no fuso de Luanda.
 */
@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    static final int MONTHS = 6;

    // estados em que o dono já aceitou e o aluguer seguiu (BookingStatus); CANCELLED_*/EXPIRED contam como perdidos
    private static final String ACCEPTED_STATES = "('ACCEPTED','ACTIVE','IN_PROGRESS','RETURNED','COMPLETED','DISPUTED')";
    private static final String LOST_STATES = "('CANCELLED_RENTER','CANCELLED_OWNER','EXPIRED')";
    private static final String MONTH_NOW = "date_trunc('month', now() AT TIME ZONE 'Africa/Luanda')";

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public AdminMetrics get() {
        List<MonthPoint> months = months();
        MonthPoint current = months.getLast();
        MonthPoint previous = months.get(months.size() - 2);
        return new AdminMetrics(
                OffsetDateTime.now(),
                new NorthStar(current.completed(), previous.completed()),
                months,
                funnel(),
                commissions(current.serviceFee()),
                kyc(),
                marketplace(),
                queues());
    }

    private List<MonthPoint> months() {
        return jdbc.query("""
                WITH months AS (
                    SELECT generate_series(%1$s - make_interval(months => ?), %1$s, interval '1 month') AS m
                ), done AS (
                    SELECT date_trunc('month', updated_at AT TIME ZONE 'Africa/Luanda') AS m, count(*) AS n
                    FROM bookings WHERE status = 'COMPLETED' GROUP BY 1
                ), paid AS (
                    SELECT date_trunc('month', confirmed_at AT TIME ZONE 'Africa/Luanda') AS m, count(*) AS n,
                           coalesce(sum(rental_amount), 0) AS rental, coalesce(sum(service_fee), 0) AS fee
                    FROM payments WHERE status = 'CONFIRMED' AND confirmed_at IS NOT NULL GROUP BY 1
                )
                SELECT to_char(months.m, 'YYYY-MM') AS month, coalesce(done.n, 0) AS completed, coalesce(paid.n, 0) AS paid,
                       coalesce(paid.rental, 0) AS rental, coalesce(paid.fee, 0) AS fee
                FROM months LEFT JOIN done ON done.m = months.m LEFT JOIN paid ON paid.m = months.m
                ORDER BY months.m
                """.formatted(MONTH_NOW),
                (rs, i) -> new MonthPoint(rs.getString("month"), rs.getLong("completed"), rs.getLong("paid"),
                        whole(rs.getBigDecimal("rental")), whole(rs.getBigDecimal("fee"))),
                MONTHS - 1);
    }

    private Funnel funnel() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT count(*) AS requested,
                       count(*) FILTER (WHERE b.status IN %s) AS accepted,
                       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM payments p
                                                      WHERE p.booking_id = b.id AND p.status = 'CONFIRMED')) AS paid,
                       count(*) FILTER (WHERE b.status = 'COMPLETED') AS completed,
                       count(*) FILTER (WHERE b.status IN %s) AS lost,
                       count(*) FILTER (WHERE b.status = 'PENDING_OWNER') AS pending
                FROM bookings b WHERE b.created_at >= now() - interval '30 days'
                """.formatted(ACCEPTED_STATES, LOST_STATES));
        return new Funnel(n(r, "requested"), n(r, "accepted"), n(r, "paid"), n(r, "completed"), n(r, "lost"), n(r, "pending"));
    }

    private Commissions commissions(BigDecimal earnedThisMonth) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT coalesce(sum(p.service_fee), 0) AS total, count(DISTINCT b.owner_id) AS owners
                FROM payments p JOIN bookings b ON b.id = p.booking_id
                WHERE p.method = 'DIRECT' AND p.status = 'CONFIRMED' AND p.commission_settled_at IS NULL
                """);
        return new Commissions(earnedThisMonth, whole((BigDecimal) r.get("total")), n(r, "owners"));
    }

    private Kyc kyc() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE status IN ('PENDING','IN_REVIEW','INFO_REQUESTED')) AS pending,
                       count(*) FILTER (WHERE reviewed_at >= now() - interval '30 days'
                                          AND status IN ('APPROVED','REJECTED')) AS decided,
                       avg(extract(epoch FROM reviewed_at - submitted_at) / 3600)
                           FILTER (WHERE reviewed_at >= now() - interval '30 days'
                                     AND status IN ('APPROVED','REJECTED')) AS hours
                FROM kyc_verifications
                """);
        Number hours = (Number) r.get("hours");
        return new Kyc(n(r, "pending"), hours == null ? null : Math.round(hours.doubleValue() * 10) / 10.0, n(r, "decided"));
    }

    private Marketplace marketplace() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT (SELECT count(*) FROM profiles WHERE role <> 'ADMIN') AS users,
                       (SELECT count(*) FROM profiles WHERE role <> 'ADMIN' AND created_at >= now() - interval '30 days') AS new_users,
                       (SELECT count(DISTINCT profile_id) FROM kyc_verifications WHERE status = 'APPROVED') AS verified,
                       (SELECT count(*) FROM items i JOIN profiles o ON o.id = i.owner_id
                        WHERE i.status = 'ACTIVE' AND o.suspended_at IS NULL) AS items,
                       (SELECT count(DISTINCT i.owner_id) FROM items i JOIN profiles o ON o.id = i.owner_id
                        WHERE i.status = 'ACTIVE' AND o.suspended_at IS NULL) AS owners
                """);
        // equipamento de donos suspensos sai do Explorar: não conta como "ativo" (antes contava)
        return new Marketplace(n(r, "users"), n(r, "new_users"), n(r, "verified"), n(r, "items"), n(r, "owners"));
    }

    private Queues queues() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT (SELECT count(*) FROM bookings WHERE status = 'PENDING_OWNER') AS awaiting,
                       (SELECT count(*) FROM bookings WHERE status IN ('ACTIVE','IN_PROGRESS')) AS in_progress,
                       (SELECT count(*) FROM bookings WHERE status = 'DISPUTED') AS disputed,
                       (SELECT count(*) FROM incident_reports WHERE status = 'OPEN') AS incidents,
                       (SELECT count(*) FROM profiles WHERE suspended_at IS NOT NULL) AS suspended
                """);
        return new Queues(n(r, "awaiting"), n(r, "in_progress"), n(r, "disputed"), n(r, "incidents"), n(r, "suspended"));
    }

    private static long n(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v == null ? 0 : ((Number) v).longValue();
    }

    // Kz inteiros (o schema guarda NUMERIC(12,2))
    private static BigDecimal whole(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(0, java.math.RoundingMode.HALF_UP);
    }
}
