package com.beeznoo.api.geo.controller;

import com.beeznoo.api.geo.dto.GeoDtos.*;
import com.beeznoo.api.geo.service.LocationService;
import com.beeznoo.api.geo.service.ServiceAreaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Zonas de serviço", description = "Onde se pode publicar equipamento e localização com consentimento")
public class GeoController {

    private final ServiceAreaService serviceAreaService;
    private final LocationService locationService;

    @Operation(summary = "Zonas ativas", description = "Público. Zonas onde se pode publicar equipamento (sem centro nem raio).")
    @GetMapping("/service-areas")
    public ResponseEntity<List<ServiceAreaSummary>> serviceAreas() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(serviceAreaService.listActive());
    }

    @Operation(summary = "Enviar a minha localização", description = """
            Localização atual do browser, com consentimento. Guarda-se só arredondada a 2 casas (~1 km), no perfil e
            no histórico. `context`: `SIGNUP`, `KYC`, `PUBLISH` ou `APP`. `accuracyM` é informativo e não se guarda.
            Devolve se o ponto está numa zona ativa. Limite: 30 por hora.
            """)
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/me/location")
    public ResponseEntity<LocationResult> location(@AuthenticationPrincipal UUID profileId,
                                                   @Valid @RequestBody LocationRequest request) {
        return ResponseEntity.ok(locationService.record(profileId, request));
    }

    @Operation(summary = "O meu consentimento e zona", description = """
            Consentimento de localização guardado na conta e zona da última localização (sem coordenadas). A app usa-o
            para não voltar a perguntar noutro dispositivo. `storedZoneUsable`: publicar sem pedir a localização outra
            vez (última localização com ≤ 30 dias numa zona ativa).
            """)
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me/location")
    public ResponseEntity<LocationStatus> myLocation(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(locationService.status(profileId));
    }

    @Operation(summary = "Posso publicar aqui?", description = """
            Só consulta (não guarda nada). Sem `lat`/`lng` → `allowed=false`, `reason=location_required`;
            fora das zonas ativas → `reason=area_not_available`. `areas` = zonas ativas.
            """)
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/me/publish-eligibility")
    public ResponseEntity<PublishEligibility> publishEligibility(@RequestParam(required = false) Double lat,
                                                                 @RequestParam(required = false) Double lng) {
        return ResponseEntity.ok(locationService.eligibility(lat, lng));
    }
}
