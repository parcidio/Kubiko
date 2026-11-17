package com.beeznoo.api.geo.service;

import com.beeznoo.api.common.exception.ApiException;
import com.beeznoo.api.geo.dto.GeoDtos.*;
import com.beeznoo.api.geo.entity.LocationContext;
import com.beeznoo.api.geo.entity.LocationEvent;
import com.beeznoo.api.geo.entity.ServiceArea;
import com.beeznoo.api.geo.repository.LocationEventRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Localização com consentimento (decisoes-produto.md 2026-11-17, itens 4–5).
 * A decisão usa o ponto recebido; o que se guarda (perfil e location_events) é só arredondado a 2 casas (~1 km).
 * Coordenadas nunca vão para logs. A localização vem do browser: controlo de produto, não de segurança.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LocationService {

    public static final String LOCATION_REQUIRED = "location_required";
    public static final String AREA_NOT_AVAILABLE = "area_not_available";

    private final ServiceAreaService serviceAreaService;
    private final LocationEventRepository eventRepository;
    private final ProfileRepository profileRepository;

    /** Fora das zonas ativas. Não faz rollback em quem a declara (o evento PUBLISH fica registado). */
    public static class AreaNotAvailableException extends ApiException {
        public AreaNotAvailableException() {
            super(HttpStatus.FORBIDDEN, AREA_NOT_AVAILABLE,
                    "Ainda não estamos na tua zona. Por agora só se publica equipamento nas zonas do piloto.");
        }
    }

    public static ApiException locationRequired() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, LOCATION_REQUIRED,
                "Partilha a tua localização para publicar equipamento.");
    }

    /** POST /me/location. */
    public LocationResult record(UUID profileId, LocationRequest request) {
        Profile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
        return record(profile, request.context(), request.lat(), request.lng());
    }

    /**
     * Guarda a localização (arredondada) no perfil e num evento. SIGNUP só fica se ainda não houver; KYC substitui.
     * Participa na transação de quem chama (registo, KYC, publicar).
     */
    public LocationResult record(Profile profile, LocationContext context, double lat, double lng) {
        validate(lat, lng);
        Optional<ServiceArea> area = serviceAreaService.findActiveContaining(lat, lng);
        BigDecimal rLat = round(lat);
        BigDecimal rLng = round(lng);
        OffsetDateTime now = OffsetDateTime.now();

        profile.setLastLat(rLat);
        profile.setLastLng(rLng);
        profile.setLastLocationAt(now);
        profile.setInServiceArea(area.isPresent());
        if (profile.getLocationConsentAt() == null) profile.setLocationConsentAt(now);
        if (context == LocationContext.SIGNUP && profile.getSignupLat() == null) {
            profile.setSignupLat(rLat);
            profile.setSignupLng(rLng);
        }
        if (context == LocationContext.KYC) {
            profile.setKycLat(rLat);
            profile.setKycLng(rLng);
        }
        profileRepository.save(profile);

        eventRepository.save(LocationEvent.builder()
                .userId(profile.getId())
                .context(context)
                .lat(rLat)
                .lng(rLng)
                .inArea(area.isPresent())
                .areaId(area.map(ServiceArea::getId).orElse(null))
                .build());
        return new LocationResult(area.isPresent(), area.map(AreaRef::from).orElse(null));
    }

    /**
     * Gate de publicar/reativar: sem localização → 422 `location_required`; regista um evento PUBLISH em cada
     * tentativa; fora das zonas ativas → 403 `area_not_available`. Quem chama declara
     * `noRollbackFor = AreaNotAvailableException.class` para o evento ficar mesmo quando recusa.
     */
    @Transactional(noRollbackFor = AreaNotAvailableException.class)
    public void assertCanPublish(Profile profile, LocationInput location) {
        if (location == null || location.lat() == null || location.lng() == null) throw locationRequired();
        LocationResult result = record(profile, LocationContext.PUBLISH, location.lat(), location.lng());
        if (!result.inServiceArea()) throw new AreaNotAvailableException();
    }

    /** GET /me/publish-eligibility: só consulta, não guarda nada. */
    @Transactional(readOnly = true)
    public PublishEligibility eligibility(Double lat, Double lng) {
        var areas = serviceAreaService.listActive();
        if (lat == null || lng == null) return new PublishEligibility(false, LOCATION_REQUIRED, areas);
        validate(lat, lng);
        boolean inside = serviceAreaService.findActiveContaining(lat, lng).isPresent();
        return new PublishEligibility(inside, inside ? null : AREA_NOT_AVAILABLE, areas);
    }

    static void validate(double lat, double lng) {
        if (!Double.isFinite(lat) || lat < -90 || lat > 90) throw new IllegalArgumentException("Latitude inválida");
        if (!Double.isFinite(lng) || lng < -180 || lng > 180) throw new IllegalArgumentException("Longitude inválida");
    }

    /** ~1 km: nunca se guarda mais precisão do que isto. */
    public static BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
