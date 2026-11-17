package com.beeznoo.api.geo.service;

import com.beeznoo.api.geo.dto.GeoDtos.*;
import com.beeznoo.api.geo.entity.ServiceArea;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Admin › Mapa (decisoes-produto.md 2026-11-17, item 6): contagens por célula de 0,05° (~5 km) a partir das
 * coordenadas já arredondadas a 2 casas. Células com menos de {@link #MIN_COUNT} pessoas não saem (contam em
 * `suppressed`), para não identificar ninguém. Não é localização de pessoas.
 */
@Service
@RequiredArgsConstructor
public class HeatmapService {

    public static final double CELL_SIZE_DEG = 0.05;
    public static final int MIN_COUNT = 3;
    // 0,05° em centésimas de grau (as coordenadas guardadas têm 2 casas)
    private static final int CELL_HUNDREDTHS = 5;
    static final String UNKNOWN_PROVINCE = "Desconhecida";
    static final String OTHER_PROVINCES = "Outras";

    private final JdbcTemplate jdbc;
    private final ServiceAreaService serviceAreaService;

    private record Row(BigDecimal lat, BigDecimal lng, String province, long count) {}

    @Transactional(readOnly = true)
    public Heatmap heatmap(HeatmapScope scope) {
        List<Row> rows = jdbc.query(sql(scope), (rs, i) -> new Row(
                rs.getBigDecimal("lat"), rs.getBigDecimal("lng"), rs.getString("province"), rs.getLong("n")));
        List<ServiceArea> areas = serviceAreaService.activeAreas();

        Map<Long, long[]> cells = new HashMap<>();          // chave da célula → [latIdx, lngIdx, count]
        Map<String, Long> provinces = new HashMap<>();
        long outside = 0;
        long withoutLocation = 0;

        for (Row row : rows) {
            if (row.lat() == null || row.lng() == null) {
                withoutLocation += row.count();
                continue;
            }
            long latIdx = Math.floorDiv(row.lat().movePointRight(2).longValueExact(), CELL_HUNDREDTHS);
            long lngIdx = Math.floorDiv(row.lng().movePointRight(2).longValueExact(), CELL_HUNDREDTHS);
            long key = (latIdx + 10_000) * 100_000 + (lngIdx + 10_000);
            cells.computeIfAbsent(key, k -> new long[]{latIdx, lngIdx, 0})[2] += row.count();

            Optional<ServiceArea> area = ServiceAreaService.findContaining(areas, row.lat().doubleValue(),
                    row.lng().doubleValue());
            if (area.isEmpty()) outside += row.count();
            String province = area.map(ServiceArea::getProvince)
                    .orElse(row.province() == null || row.province().isBlank() ? UNKNOWN_PROVINCE : row.province().strip());
            provinces.merge(province, row.count(), Long::sum);
        }

        List<HeatmapCell> visible = new ArrayList<>();
        long suppressed = 0;
        for (long[] c : cells.values()) {
            if (c[2] < MIN_COUNT) {
                suppressed += c[2];
            } else {
                visible.add(new HeatmapCell(center(c[0]), center(c[1]), c[2]));
            }
        }
        visible.sort(Comparator.comparingLong(HeatmapCell::count).reversed()
                .thenComparingDouble(HeatmapCell::lat).thenComparingDouble(HeatmapCell::lng));

        // províncias com poucas pessoas juntam-se em "Outras" pela mesma razão
        List<ProvinceCount> byProvince = new ArrayList<>();
        long others = 0;
        for (var e : provinces.entrySet()) {
            if (e.getValue() < MIN_COUNT) others += e.getValue();
            else byProvince.add(new ProvinceCount(e.getKey(), e.getValue()));
        }
        byProvince.sort(Comparator.comparingLong(ProvinceCount::count).reversed().thenComparing(ProvinceCount::province));
        if (others > 0) byProvince.add(new ProvinceCount(OTHER_PROVINCES, others));

        return new Heatmap(scope.name(), CELL_SIZE_DEG, MIN_COUNT, visible, byProvince, outside, suppressed,
                withoutLocation);
    }

    // centro da célula, arredondado a 3 casas
    private static double center(long idx) {
        return BigDecimal.valueOf(idx * CELL_HUNDREDTHS * 10L + 25L, 3).doubleValue();
    }

    // Coordenadas do momento certo (KYC ou registo), senão a última conhecida. Admins não contam.
    private static String sql(HeatmapScope scope) {
        String coords = scope == HeatmapScope.SIGNUP
                ? "coalesce(p.signup_lat, p.last_lat) AS lat, CASE WHEN p.signup_lat IS NOT NULL THEN p.signup_lng ELSE p.last_lng END AS lng"
                : "coalesce(p.kyc_lat, p.last_lat) AS lat, CASE WHEN p.kyc_lat IS NOT NULL THEN p.kyc_lng ELSE p.last_lng END AS lng";
        String filter = switch (scope) {
            case SIGNUP -> "";
            case KYC_SUBMITTED -> "AND EXISTS (SELECT 1 FROM kyc_verifications k WHERE k.profile_id = p.id)";
            case KYC_APPROVED -> "AND EXISTS (SELECT 1 FROM kyc_verifications k WHERE k.profile_id = p.id AND k.status = 'APPROVED')";
        };
        return """
                SELECT lat, lng, province, count(*) AS n FROM (
                    SELECT %s, p.province FROM profiles p WHERE p.role <> 'ADMIN' %s
                ) x GROUP BY lat, lng, province
                """.formatted(coords, filter);
    }
}
