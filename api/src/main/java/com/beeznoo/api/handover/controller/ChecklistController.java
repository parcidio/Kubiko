package com.beeznoo.api.handover.controller;

import com.beeznoo.api.handover.dto.ChecklistDtos.ChecklistResponse;
import com.beeznoo.api.handover.entity.ChecklistType;
import com.beeznoo.api.handover.service.ChecklistService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
@RequestMapping("/api/v1/bookings/{bookingId}/checklists")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Entrega e devolução", description = "Checklists com fotos, registadas por uma parte e confirmadas pela outra")
public class ChecklistController {

    private final ChecklistService checklistService;

    @Operation(
            summary = "Registar entrega ou devolução",
            description = """
                    `type`: `delivery` (reserva `ACTIVE`) ou `return` (reserva `IN_PROGRESS`).
                    `multipart/form-data`: `notes` (estado do equipamento) e 2 a 10 partes `photos`
                    (JPEG/PNG, até 5 MB). Qualquer uma das partes regista; a outra é avisada para confirmar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Registo criado, à espera da confirmação da outra parte",
                    content = @Content(schema = @Schema(implementation = ChecklistResponse.class))),
            @ApiResponse(responseCode = "400", description = "Notas ou fotos em falta / inválidas, reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Já registada ou reserva no estado errado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping(value = "/{type}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ChecklistResponse> create(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId,
            @Parameter(description = "delivery | return") @PathVariable String type,
            @RequestParam String notes,
            @RequestPart("photos") List<MultipartFile> photos) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(checklistService.create(profileId, bookingId, parse(type), notes, photos));
    }

    @Operation(
            summary = "Confirmar entrega ou devolução",
            description = """
                    Só a outra parte (não quem registou). Entrega: `ACTIVE` → `IN_PROGRESS`.
                    Devolução: `IN_PROGRESS` → `RETURNED` (a equipa decide a caução).
                    Se não concordas com o registo, reporta um problema em vez de confirmar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Confirmado",
                    content = @Content(schema = @Schema(implementation = ChecklistResponse.class))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Sem registo, quem registou não pode confirmar, ou estado errado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{type}/confirm")
    public ResponseEntity<ChecklistResponse> confirm(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId,
            @Parameter(description = "delivery | return") @PathVariable String type) {
        return ResponseEntity.ok(checklistService.confirm(profileId, bookingId, parse(type)));
    }

    @Operation(
            summary = "Checklists da reserva",
            description = "Entrega e devolução com fotos (URL assinada de 10 min). Partes da reserva e admin."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Checklists devolvidas",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = ChecklistResponse.class)))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Sem acesso à reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<List<ChecklistResponse>> list(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(checklistService.list(profileId, bookingId));
    }

    private static ChecklistType parse(String type) {
        return switch (type.toLowerCase()) {
            case "delivery" -> ChecklistType.DELIVERY;
            case "return" -> ChecklistType.RETURN;
            default -> throw new IllegalArgumentException("Tipo inválido: usa delivery ou return");
        };
    }

    record ErrorResponse(String error) {}
}
