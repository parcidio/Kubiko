package com.beeznoo.api.geo.dto;

import com.beeznoo.api.geo.entity.LocationContext;
import com.beeznoo.api.geo.entity.ServiceArea;
import jakarta.validation.constraints.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Contrato: docs/API_ADMIN_MESSAGES_GEO.md (Zonas de serviço, Mapa). */
public class GeoDtos {

    /** Localização atual do browser. Usada para decidir e guardada só arredondada a 2 casas (~1 km). */
    public record LocationInput(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double lng
    ) {}

    /** POST /me/location. `accuracyM` é informativo e não se guarda. */
    public record LocationRequest(
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double lng,
            @Min(0) @Max(1_000_000) Integer accuracyM,
            @NotNull LocationContext context
    ) {}

    public record AreaRef(String province, String city) {
        public static AreaRef from(ServiceArea a) {
            return a == null ? null : new AreaRef(a.getProvince(), a.getCity());
        }
    }

    public record LocationResult(boolean inServiceArea, AreaRef area) {}

    /** GET /service-areas (público) e lista de zonas em `publish-eligibility`. */
    public record ServiceAreaSummary(UUID id, String province, String city, boolean active) {
        public static ServiceAreaSummary from(ServiceArea a) {
            return new ServiceAreaSummary(a.getId(), a.getProvince(), a.getCity(), a.isActive());
        }
    }

    /** Admin: zona com centro e raio. */
    public record ServiceAreaResponse(
            UUID id, String province, String city, double lat, double lng, int radiusKm, boolean active,
            OffsetDateTime createdAt, OffsetDateTime updatedAt
    ) {
        public static ServiceAreaResponse from(ServiceArea a) {
            return new ServiceAreaResponse(a.getId(), a.getProvince(), a.getCity(), a.getCenterLat().doubleValue(),
                    a.getCenterLng().doubleValue(), a.getRadiusKm(), a.isActive(), a.getCreatedAt(), a.getUpdatedAt());
        }
    }

    /** POST/PUT /admin/service-areas. `active` omitido = ativa (criar) ou sem mudança (editar). */
    public record ServiceAreaRequest(
            @NotBlank @Size(max = 100) String province,
            @NotBlank @Size(max = 100) String city,
            @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double lat,
            @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double lng,
            @NotNull @Min(1) @Max(500) Integer radiusKm,
            Boolean active
    ) {}

    /** GET /me/publish-eligibility. `reason`: null, `location_required` ou `area_not_available`. */
    public record PublishEligibility(boolean allowed, String reason, List<ServiceAreaSummary> areas) {}

    // ---- Mapa (Admin › Mapa) ----

    public enum HeatmapScope { KYC_APPROVED, KYC_SUBMITTED, SIGNUP }

    /** Centro da célula de `cellSizeDeg` graus e número de pessoas (sempre ≥ minCount). */
    public record HeatmapCell(double lat, double lng, long count) {}

    public record ProvinceCount(String province, long count) {}

    /**
     * Contagens agregadas, nunca pessoas. `suppressed` = pessoas em células abaixo de `minCount` (não aparecem em
     * `cells`); `outsideAreas` = pessoas fora das zonas ativas; `withoutLocation` = pessoas do âmbito sem localização.
     */
    public record Heatmap(
            String scope,
            double cellSizeDeg,
            int minCount,
            List<HeatmapCell> cells,
            List<ProvinceCount> byProvince,
            long outsideAreas,
            long suppressed,
            long withoutLocation
    ) {}
}
