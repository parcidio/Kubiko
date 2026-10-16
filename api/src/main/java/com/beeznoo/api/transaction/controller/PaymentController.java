package com.beeznoo.api.transaction.controller;

import com.beeznoo.api.transaction.dto.PaymentDtos.PaymentResponse;
import com.beeznoo.api.transaction.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Pagamentos", description = "Pagamento de reservas por referência Multicaixa (simulado no MVP)")
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(
            summary = "Gerar referência de pagamento",
            description = """
                    Emite uma referência (entidade + referência + montante) para uma reserva `ACCEPTED`.
                    Montante = aluguer + taxa de serviço (8%) + caução.

                    Idempotente: se já existir uma referência válida em aberto, devolve-a.
                    Se a anterior expirou, marca-a `EXPIRED` e emite uma nova.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Referência emitida (ou a já existente)",
                    content = @Content(schema = @Schema(implementation = PaymentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o arrendatário da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não está ACCEPTED",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/bookings/{bookingId}/payments")
    public ResponseEntity<PaymentResponse> create(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentService.createReference(profileId, bookingId));
    }

    @Operation(
            summary = "Pagamento atual da reserva",
            description = """
                    Devolve o pagamento mais recente da reserva (qualquer estado).
                    Responde `204` se ainda não foi gerada nenhuma referência.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Pagamento mais recente",
                    content = @Content(schema = @Schema(implementation = PaymentResponse.class))),
            @ApiResponse(responseCode = "204", description = "Ainda sem referência"),
            @ApiResponse(responseCode = "400", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o arrendatário da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/bookings/{bookingId}/payments/current")
    public ResponseEntity<PaymentResponse> current(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID bookingId) {
        return paymentService.findCurrent(profileId, bookingId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(
            summary = "Verificar pagamento (\"Já paguei\")",
            description = """
                    Pergunta ao gateway se a referência foi paga. Se sim, liquida no ledger
                    (TOPUP → SERVICE_FEE → HOLD → PAYMENT) e a reserva passa a `ACTIVE`.

                    Gateway simulado: com `app.payments.simulated.auto-confirm=true` confirma logo;
                    caso contrário fica `AWAITING_PAYMENT` até o admin validar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado atualizado do pagamento",
                    content = @Content(schema = @Schema(implementation = PaymentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Pagamento não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o arrendatário da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva deixou de estar à espera de pagamento",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/payments/{paymentId}/check")
    public ResponseEntity<PaymentResponse> check(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID paymentId) {
        return ResponseEntity.ok(paymentService.check(profileId, paymentId));
    }

    record ErrorResponse(String error) {}
}
