package com.beeznoo.api.deposit.controller;

import com.beeznoo.api.deposit.dto.DepositDtos.*;
import com.beeznoo.api.deposit.service.DepositService;
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
@RequestMapping("/api/v1/admin/deposits")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Cauções", description = "Libertar ou reter a caução depois da devolução ou de um problema")
public class AdminDepositController {

    private final DepositService depositService;

    @Operation(
            summary = "Fila de cauções",
            description = "Cauções retidas de reservas `RETURNED` ou `DISPUTED`, mais antigas primeiro. Apenas ADMIN."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fila devolvida",
                    content = @Content(schema = @Schema(implementation = DepositResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<DepositResponse>> queue(Pageable pageable) {
        return ResponseEntity.ok(depositService.queue(pageable));
    }

    @Operation(
            summary = "Libertar caução",
            description = """
                    Devolve a caução inteira ao arrendatário e conclui a reserva (`COMPLETED`).
                    `reason` opcional, fica na auditoria. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Caução libertada",
                    content = @Content(schema = @Schema(implementation = DepositResponse.class))),
            @ApiResponse(responseCode = "400", description = "Reserva sem caução",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Caução já decidida ou reserva ainda não devolvida",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{bookingId}/release")
    public ResponseEntity<DepositResponse> release(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID bookingId,
            @Valid @RequestBody(required = false) ReleaseRequest request) {
        return ResponseEntity.ok(depositService.release(adminId, bookingId, request == null ? null : request.reason()));
    }

    @Operation(
            summary = "Reter caução (parcial ou total)",
            description = """
                    `amount` em Kz inteiros: quanto fica para o dono (até ao valor da caução); o resto volta ao
                    arrendatário. `reason` obrigatório (visível para as duas partes e na auditoria).
                    Conclui a reserva (`COMPLETED`). Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Caução retida",
                    content = @Content(schema = @Schema(implementation = DepositResponse.class))),
            @ApiResponse(responseCode = "400", description = "Valor inválido, motivo em falta ou reserva sem caução",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Caução já decidida ou reserva ainda não devolvida",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/{bookingId}/withhold")
    public ResponseEntity<DepositResponse> withhold(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID bookingId,
            @Valid @RequestBody WithholdRequest request) {
        return ResponseEntity.ok(depositService.withhold(adminId, bookingId, request.amount(), request.reason()));
    }

    record ErrorResponse(String error) {}
}
