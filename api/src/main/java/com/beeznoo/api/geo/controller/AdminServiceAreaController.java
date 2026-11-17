package com.beeznoo.api.geo.controller;

import com.beeznoo.api.geo.dto.GeoDtos.*;
import com.beeznoo.api.geo.service.ServiceAreaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Admin › Zonas. Sem DELETE: desativa-se com `active=false`. Cada mudança fica em auditoria (SERVICE_AREA_CHANGED). */
@RestController
@RequestMapping("/api/v1/admin/service-areas")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Zonas de serviço", description = "Zonas onde se pode publicar equipamento")
public class AdminServiceAreaController {

    private final ServiceAreaService serviceAreaService;

    @Operation(summary = "Todas as zonas (ativas e inativas), com centro e raio")
    @GetMapping
    public ResponseEntity<List<ServiceAreaResponse>> list() {
        return ResponseEntity.ok(serviceAreaService.listAll());
    }

    @Operation(summary = "Criar zona", description = "409 se já existir zona com a mesma província e cidade.")
    @PostMapping
    public ResponseEntity<ServiceAreaResponse> create(@AuthenticationPrincipal UUID adminId,
                                                      @Valid @RequestBody ServiceAreaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(serviceAreaService.create(adminId, request));
    }

    @Operation(summary = "Editar ou ativar/desativar zona")
    @PutMapping("/{id}")
    public ResponseEntity<ServiceAreaResponse> update(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                      @Valid @RequestBody ServiceAreaRequest request) {
        return ResponseEntity.ok(serviceAreaService.update(adminId, id, request));
    }
}
