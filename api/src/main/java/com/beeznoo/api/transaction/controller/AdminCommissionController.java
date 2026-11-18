package com.beeznoo.api.transaction.controller;

import com.beeznoo.api.transaction.dto.PaymentDtos.CommissionDue;
import com.beeznoo.api.transaction.dto.PaymentDtos.SettleCommissionsRequest;
import com.beeznoo.api.transaction.dto.PaymentDtos.SettleCommissionsResponse;
import com.beeznoo.api.transaction.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.beeznoo.api.config.AdminAccess;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Comissões a receber dos donos no modo de pagamento direto (decisoes-produto.md 2026-11-15). */
@RestController
@RequestMapping("/api/v1/admin/commissions")
@RequiredArgsConstructor
@PreAuthorize(AdminAccess.OPERATIONS)
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Comissões", description = "Taxa de serviço que os donos devem à Beeznoo")
public class AdminCommissionController {

    private final PaymentService paymentService;

    @Operation(summary = "Comissões por receber", description = """
            Um registo por dono com pagamentos diretos confirmados cuja taxa de serviço ainda não foi recebida:
            total, número de pagamentos e data do mais antigo (quem deve há mais tempo primeiro). Apenas ADMIN.
            """)
    @GetMapping
    public ResponseEntity<List<CommissionDue>> due() {
        return ResponseEntity.ok(paymentService.commissionsDue());
    }

    @Operation(summary = "Registar comissões recebidas", description = """
            A equipa recebeu do dono (fora da app) todas as comissões em aberto. Marca-as como recebidas e fica na
            auditoria (`COMMISSION_SETTLED`, com o total e os pagamentos). Corpo opcional `{ "reason": "..." }`.
            409 se o dono não tiver comissões por pagar. Apenas ADMIN.
            """)
    @PostMapping("/{ownerId}/settle")
    public ResponseEntity<SettleCommissionsResponse> settle(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID ownerId,
            @Valid @RequestBody(required = false) SettleCommissionsRequest request) {
        return ResponseEntity.ok(paymentService.settleCommissions(adminId, ownerId, request == null ? null : request.reason()));
    }
}
