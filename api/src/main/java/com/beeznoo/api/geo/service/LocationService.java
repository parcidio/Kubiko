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
    /** A última localização guardada serve para publicar sem perguntar outra vez durante este tempo (2026-11-18). */
    public static final int STORED_MAX_AGE_DAYS = 30;
    /** Zona escolhida à mão é recusada se a localização do browser das últimas horas disse "fora das zonas". */
    static final int RECENT_GPS_HOURS = 24;

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

    /** Compatível com quem só passa a localização do browser. */
    @Transactional(noRollbackFor = AreaNotAvailableException.class)
    public void assertCanPublish(Profile profile, LocationInput location) {
        assertCanPublish(profile, location, null);
    }

    /**
     * Gate de publicar/reativar, por ordem (decisoes-produto.md 2026-11-17 item 4 e 2026-11-18):
     * <ol>
     *   <li>localização do browser → regista um evento PUBLISH; fora das zonas ativas → 403 `area_not_available`;</li>
     *   <li>zona escolhida à mão (`areaId`) → tem de estar ativa; recusada se a localização do browser das últimas
     *       {@value #RECENT_GPS_HOURS} h disse "fora". Não cria evento (não há coordenadas);</li>
     *   <li>nada → última localização guardada na conta, se houver consentimento, tiver ≤ {@value #STORED_MAX_AGE_DAYS}
     *       dias e estiver numa zona ativa (outro dispositivo, browser sem localização);</li>
     *   <li>senão → 422 `location_required`.</li>
     * </ol>
     * Quem chama declara `noRollbackFor = AreaNotAvailableException.class` para o evento ficar mesmo quando recusa.
     */
    @Transactional(noRollbackFor = AreaNotAvailableException.class)
    public void assertCanPublish(Profile profile, LocationInput location, UUID areaId) {
        if (location != null && location.lat() != null && location.lng() != null) {
            LocationResult result = record(profile, LocationContext.PUBLISH, location.lat(), location.lng());
            if (!result.inServiceArea()) throw new AreaNotAvailableException();
            return;
        }
        if (areaId != null) {
            boolean active = serviceAreaService.activeAreas().stream().anyMatch(a -> a.getId().equals(areaId));
            if (!active || recentlyOutside(profile)) throw new AreaNotAvailableException();
            return;
        }
        if (storedArea(profile).isPresent()) return;
        throw locationRequired();
    }

    /** GET /me/location: consentimento e zona guardados na conta (sem coordenadas). */
    @Transactional(readOnly = true)
    public LocationStatus status(UUID profileId) {
        return profileRepository.findById(profileId).map(this::status).orElse(LocationStatus.NONE);
    }

    @Transactional(readOnly = true)
    public LocationStatus status(Profile profile) {
        if (profile.getLastLat() == null || profile.getLastLng() == null) {
            return new LocationStatus(profile.getLocationConsentAt() != null, profile.getLocationConsentAt(),
                    null, null, null, false);
        }
        Optional<ServiceArea> area = serviceAreaService.findActiveContaining(
                profile.getLastLat().doubleValue(), profile.getLastLng().doubleValue());
        return new LocationStatus(profile.getLocationConsentAt() != null, profile.getLocationConsentAt(),
                profile.getLastLocationAt(), area.isPresent(), area.map(AreaRef::from).orElse(null),
                storedArea(profile).isPresent());
    }

    /** Zona ativa da última localização guardada, se ainda serve para publicar. */
    private Optional<ServiceArea> storedArea(Profile profile) {
        if (profile.getLocationConsentAt() == null || profile.getLastLat() == null || profile.getLastLng() == null
                || profile.getLastLocationAt() == null
                || profile.getLastLocationAt().isBefore(OffsetDateTime.now().minusDays(STORED_MAX_AGE_DAYS))) {
            return Optional.empty();
        }
        return serviceAreaService.findActiveContaining(profile.getLastLat().doubleValue(),
                profile.getLastLng().doubleValue());
    }

    private static boolean recentlyOutside(Profile profile) {
        return Boolean.FALSE.equals(profile.getInServiceArea())
                && profile.getLastLocationAt() != null
                && profile.getLastLocationAt().isAfter(OffsetDateTime.now().minusHours(RECENT_GPS_HOURS));
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
