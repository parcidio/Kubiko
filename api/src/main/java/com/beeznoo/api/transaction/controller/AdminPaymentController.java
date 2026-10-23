package com.beeznoo.api.transaction.controller;

import com.beeznoo.api.transaction.dto.PaymentDtos.AdminPaymentItem;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import com.beeznoo.api.transaction.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/payments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Pagamentos", description = "Fila de pagamentos por referência a validar")
public class AdminPaymentController {

    private final PaymentService paymentService;

    @Operation(
            summary = "Fila de pagamentos",
            description = """
                    Pagamentos no estado `status` (por omissão `AWAITING_PAYMENT`), mais antigos primeiro.
                    Para validar um pagamento recebido: `PATCH /bookings/{bookingId}/confirm-payment`. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fila devolvida",
                    content = @Content(schema = @Schema(implementation = AdminPaymentItem.class))),
            @ApiResponse(responseCode = "400", description = "Estado inválido",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<AdminPaymentItem>> queue(
            @RequestParam(defaultValue = "AWAITING_PAYMENT") PaymentStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(paymentService.adminQueue(status, pageable));
    }

    record ErrorResponse(String error) {}
}
