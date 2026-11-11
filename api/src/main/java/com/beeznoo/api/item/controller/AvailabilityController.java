package com.beeznoo.api.item.controller;

import com.beeznoo.api.item.dto.AvailabilityDtos.*;
import com.beeznoo.api.item.service.AvailabilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/items/{itemId}")
@RequiredArgsConstructor
@Tag(name = "Disponibilidade", description = "Datas ocupadas (reservas) e bloqueadas pelo dono")
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    @Operation(
            summary = "Disponibilidade do equipamento",
            description = """
                    Dias indisponíveis na janela `from`..`to` (inclusiva; por omissão hoje + 180 dias, máx. 366).
                    Cada intervalo é **inclusivo** (`start <= dia <= end`) com `reason` `BOOKED` (reserva aceite ou
                    em curso) ou `BLOCKED` (o dono bloqueou). Uma reserva de 16 a 18 ocupa os dias 16 e 17: o dia
                    de devolução fica livre para a reserva seguinte. Público; sem nomes nem notas.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Disponibilidade",
                    content = @Content(schema = @Schema(implementation = AvailabilityResponse.class))),
            @ApiResponse(responseCode = "400", description = "Item não encontrado ou janela inválida",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/availability")
    public ResponseEntity<AvailabilityResponse> availability(
            @PathVariable UUID itemId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(availabilityService.availability(itemId, from, to));
    }

    @Operation(summary = "Os meus bloqueios de datas", description = "Bloqueios atuais e futuros, com a nota. Só o dono.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Bloqueios",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = BlockResponse.class)))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o dono",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/blocks")
    public ResponseEntity<List<BlockResponse>> blocks(@AuthenticationPrincipal UUID profileId, @PathVariable UUID itemId) {
        return ResponseEntity.ok(availabilityService.listBlocks(profileId, itemId));
    }

    @Operation(
            summary = "Bloquear datas",
            description = """
                    Dias **inclusivos** `startDate`..`endDate` (o mesmo dia nos dois = um dia). Não pode ser no passado,
                    nem tocar uma reserva aceite ou em curso, nem passar de 366 dias. Máx. 100 bloqueios futuros por
                    item. Pedidos pendentes nessas datas continuam a existir, mas deixam de poder ser aceites.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Bloqueio criado",
                    content = @Content(schema = @Schema(implementation = BlockResponse.class))),
            @ApiResponse(responseCode = "400", description = "Datas inválidas",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o dono",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Há uma reserva aceite nessas datas ou bloqueios a mais",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/blocks")
    public ResponseEntity<BlockResponse> create(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID itemId,
            @Valid @RequestBody CreateBlockRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(availabilityService.createBlock(profileId, itemId, request));
    }

    @Operation(summary = "Desbloquear datas", description = "Remove um bloqueio. Só o dono.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Removido"),
            @ApiResponse(responseCode = "400", description = "Bloqueio não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o dono",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/blocks/{blockId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID itemId,
            @PathVariable UUID blockId) {
        availabilityService.deleteBlock(profileId, itemId, blockId);
        return ResponseEntity.noContent().build();
    }

    record ErrorResponse(String error) {}
}
