package com.beeznoo.api.geo.controller;

import com.beeznoo.api.geo.dto.GeoDtos.Heatmap;
import com.beeznoo.api.geo.dto.GeoDtos.HeatmapScope;
import com.beeznoo.api.geo.service.HeatmapService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/metrics/heatmap")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Métricas", description = "North Star e funil do MVP")
public class AdminHeatmapController {

    private final HeatmapService heatmapService;

    @Operation(summary = "Mapa de calor (agregado)", description = """
            Contagem de pessoas por célula de 0,05° (~5 km), a partir das coordenadas arredondadas.
            `scope`: `KYC_SUBMITTED` (omissão), `KYC_APPROVED` ou `SIGNUP` (todas as contas com localização).
            Quem fica numa célula fina com menos de `minCount` (3) junta-se numa célula de 0,25° (~28 km,
            `sizeDeg` na célula); o que nem assim chega a 3 não sai e soma-se em `suppressed`. `byProvince`: província da zona ativa, senão a do perfil (com menos de 3,
            juntam-se em "Outras"). `outsideAreas`: fora das zonas ativas. Sem dados pessoais. Apenas ADMIN.
            """)
    @GetMapping
    public ResponseEntity<Heatmap> heatmap(@RequestParam(defaultValue = "KYC_SUBMITTED") HeatmapScope scope) {
        return ResponseEntity.ok(heatmapService.heatmap(scope));
    }
}
