package com.beeznoo.api.contract.controller;

import com.beeznoo.api.contract.dto.ContractDtos.ContractResponse;
import com.beeznoo.api.contract.service.ContractService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/contract")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Contrato", description = "Contrato de aluguer de cada reserva")
public class ContractController {

    private final ContractService contractService;

    @Operation(
            summary = "Contrato da reserva",
            description = """
                    Texto do contrato (versão + SHA-256) gerado quando o dono aceitou o pedido, e quem já aceitou.
                    O dono aceita ao aceitar o pedido. Arrendatário, dono ou admin.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contrato devolvido",
                    content = @Content(schema = @Schema(implementation = ContractResponse.class))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "O dono ainda não aceitou (sem contrato)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<ContractResponse> get(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(contractService.get(profileId, bookingId));
    }

    @Operation(
            summary = "Aceitar o contrato (arrendatário)",
            description = """
                    Obrigatório antes de gerar a referência de pagamento. Só com a reserva `ACCEPTED`.
                    Idempotente: aceitar outra vez não muda a data.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contrato aceite",
                    content = @Content(schema = @Schema(implementation = ContractResponse.class))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o arrendatário",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Sem contrato ou reserva fora de ACCEPTED",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/accept")
    public ResponseEntity<ContractResponse> accept(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(contractService.acceptAsRenter(profileId, bookingId));
    }

    record ErrorResponse(String error) {}
}
