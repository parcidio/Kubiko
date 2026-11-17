package com.beeznoo.api.geo.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.geo.dto.GeoDtos.*;
import com.beeznoo.api.geo.entity.ServiceArea;
import com.beeznoo.api.geo.repository.ServiceAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Zonas de serviço (decisoes-produto.md 2026-11-17, item 4): círculo de centro + raio, ativas ou não.
 * Pertença por distância de haversine ao centro. Sem delete: desativa-se.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ServiceAreaService {

    // raio médio da Terra (IUGG)
    static final double EARTH_RADIUS_KM = 6371.0088;

    private final ServiceAreaRepository repository;
    private final AuditService auditService;

    /** Distância de círculo máximo em km. */
    public static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    public static boolean contains(ServiceArea area, double lat, double lng) {
        return distanceKm(area.getCenterLat().doubleValue(), area.getCenterLng().doubleValue(), lat, lng)
                <= area.getRadiusKm();
    }

    /** Zona ativa que contém o ponto (a de centro mais próximo, se houver várias). */
    @Transactional(readOnly = true)
    public Optional<ServiceArea> findActiveContaining(double lat, double lng) {
        return findContaining(repository.findByActiveTrueOrderByProvinceAscCityAsc(), lat, lng);
    }

    public static Optional<ServiceArea> findContaining(List<ServiceArea> areas, double lat, double lng) {
        return areas.stream()
                .filter(a -> contains(a, lat, lng))
                .min(Comparator.comparingDouble(a ->
                        distanceKm(a.getCenterLat().doubleValue(), a.getCenterLng().doubleValue(), lat, lng)));
    }

    @Transactional(readOnly = true)
    public List<ServiceArea> activeAreas() {
        return repository.findByActiveTrueOrderByProvinceAscCityAsc();
    }

    @Transactional(readOnly = true)
    public List<ServiceAreaSummary> listActive() {
        return activeAreas().stream().map(ServiceAreaSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ServiceAreaResponse> listAll() {
        return repository.findAllByOrderByProvinceAscCityAsc().stream().map(ServiceAreaResponse::from).toList();
    }

    public ServiceAreaResponse create(UUID adminId, ServiceAreaRequest request) {
        String province = request.province().strip();
        String city = request.city().strip();
        if (repository.existsByProvinceIgnoreCaseAndCityIgnoreCase(province, city)) {
            throw new IllegalStateException("Já existe uma zona para " + city + ", " + province);
        }
        ServiceArea area = ServiceArea.builder()
                .province(province)
                .city(city)
                .centerLat(center(request.lat()))
                .centerLng(center(request.lng()))
                .radiusKm(request.radiusKm())
                .active(request.active() == null || request.active())
                .build();
        repository.save(area);
        audit(adminId, area, "created");
        return ServiceAreaResponse.from(area);
    }

    public ServiceAreaResponse update(UUID adminId, UUID id, ServiceAreaRequest request) {
        ServiceArea area = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Zona não encontrada"));
        String province = request.province().strip();
        String city = request.city().strip();
        if (repository.existsByProvinceIgnoreCaseAndCityIgnoreCaseAndIdNot(province, city, id)) {
            throw new IllegalStateException("Já existe uma zona para " + city + ", " + province);
        }
        area.setProvince(province);
        area.setCity(city);
        area.setCenterLat(center(request.lat()));
        area.setCenterLng(center(request.lng()));
        area.setRadiusKm(request.radiusKm());
        if (request.active() != null) area.setActive(request.active());
        repository.saveAndFlush(area);
        audit(adminId, area, "updated");
        return ServiceAreaResponse.from(area);
    }

    private void audit(UUID adminId, ServiceArea area, String change) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("change", change);
        metadata.put("province", area.getProvince());
        metadata.put("city", area.getCity());
        metadata.put("radiusKm", area.getRadiusKm());
        metadata.put("active", area.isActive());
        auditService.record(adminId, AuditAction.SERVICE_AREA_CHANGED, AuditService.SERVICE_AREA, area.getId(),
                null, metadata);
    }

    private static BigDecimal center(double value) {
        return BigDecimal.valueOf(value).setScale(5, RoundingMode.HALF_UP);
    }
}
