package com.beeznoo.api.claim.controller;

import com.beeznoo.api.claim.dto.IncidentDtos.IncidentResponse;
import com.beeznoo.api.claim.entity.IncidentType;
import com.beeznoo.api.claim.service.IncidentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/incidents")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Reportar problema", description = "Dano, perda, roubo ou outro problema numa reserva")
public class IncidentController {

    private final IncidentService incidentService;

    @Operation(
            summary = "Reportar problema",
            description = """
                    `multipart/form-data`: `type` (`DAMAGE`, `LOSS`, `THEFT`, `OTHER`), `description` e até 6 partes
                    `photos` (JPEG/PNG, 5 MB). Só numa reserva paga e ainda não concluída
                    (`ACTIVE`, `IN_PROGRESS`, `RETURNED` ou `DISPUTED`). A reserva passa a `DISPUTED` e a equipa é avisada.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Problema registado",
                    content = @Content(schema = @Schema(implementation = IncidentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Tipo, descrição ou fotos inválidos; reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não paga ou já concluída",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<IncidentResponse> report(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId,
            @RequestParam IncidentType type,
            @RequestParam String description,
            @RequestPart(value = "photos", required = false) List<MultipartFile> photos) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(incidentService.report(profileId, bookingId, type, description, photos));
    }

    @Operation(summary = "Problemas da reserva", description = "Com fotos (URL assinada de 10 min). Partes da reserva e admin.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Problemas devolvidos",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = IncidentResponse.class)))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Sem acesso à reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<List<IncidentResponse>> list(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(incidentService.listForBooking(profileId, bookingId));
    }

    record ErrorResponse(String error) {}
}
