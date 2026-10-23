package com.beeznoo.api.claim.controller;

import com.beeznoo.api.claim.dto.IncidentDtos.IncidentResponse;
import com.beeznoo.api.claim.dto.IncidentDtos.ResolveRequest;
import com.beeznoo.api.claim.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/incidents")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Problemas", description = "Fila de problemas reportados e resolução manual")
public class AdminIncidentController {

    private final IncidentService incidentService;

    @Operation(summary = "Fila de problemas", description = "Problemas `OPEN`, mais antigos primeiro. Apenas ADMIN.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fila devolvida",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<IncidentResponse>> queue(Pageable pageable) {
        return ResponseEntity.ok(incidentService.queue(pageable));
    }

    @Operation(summary = "Detalhe do problema", description = "Com fotos (URL assinada de 10 min). Apenas ADMIN.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Detalhe devolvido",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Problema não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(incidentService.detail(id));
    }

    @Operation(
            summary = "Resolver problema",
            description = """
                    Fecha o caso com `note` (obrigatória, fica na auditoria). Não mexe em dinheiro: liberta ou retém a
                    caução em `/admin/deposits/{bookingId}`. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Problema resolvido",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Nota em falta ou problema não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Já resolvido",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/resolve")
    public ResponseEntity<IncidentResponse> resolve(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID id,
            @Valid @RequestBody ResolveRequest request) {
        return ResponseEntity.ok(incidentService.resolve(adminId, id, request.note()));
    }

    record ErrorResponse(String error) {}
}
