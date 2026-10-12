package com.beeznoo.api.transaction.controller;

import com.beeznoo.api.transaction.dto.LedgerDtos.*;
import com.beeznoo.api.transaction.service.LedgerService;
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
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Ledger", description = "Saldo da conta, extracto de movimentos e ajustes manuais")
public class LedgerController {

    private final LedgerService ledgerService;

    @Operation(
            summary = "O meu saldo",
            description = """
                    Devolve a conta do perfil autenticado:
                    - `availableBalance` -- saldo disponível para novas reservas
                    - `heldBalance` -- valor retido em reservas aceites e cauções
                    - `currency` -- moeda da conta (AOA)
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Conta devolvida com sucesso",
                    content = @Content(schema = @Schema(implementation = AccountResponse.class))),
            @ApiResponse(responseCode = "400", description = "Conta não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/accounts/me")
    public ResponseEntity<AccountResponse> getMyAccount(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(ledgerService.getMyAccount(profileId));
    }

    @Operation(
            summary = "O meu extracto",
            description = """
                    Devolve, paginados, os movimentos da conta do perfil autenticado,
                    do mais recente para o mais antigo.

                    Cada movimento indica o `type` (HOLD, PAYMENT_DEBIT, DEPOSIT_RETURN, ...),
                    o `amount` (sempre positivo) e o `balanceAfter` -- saldo disponível
                    imediatamente após o movimento.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Extracto devolvido com sucesso",
                    content = @Content(schema = @Schema(implementation = LedgerEntryResponse.class))),
            @ApiResponse(responseCode = "400", description = "Conta não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/accounts/me/statement")
    public ResponseEntity<Page<LedgerEntryResponse>> getMyStatement(
            @AuthenticationPrincipal UUID profileId,
            Pageable pageable) {
        return ResponseEntity.ok(ledgerService.getMyStatement(profileId, pageable));
    }

    @Operation(
            summary = "Ajuste manual de saldo (admin)",
            description = """
                    Altera o saldo disponível de uma conta e regista um movimento ADJUSTMENT.
                    - `amount` positivo -- credita a conta
                    - `amount` negativo -- debita a conta (falha se o saldo for insuficiente)

                    A `description` é obrigatória e fica no extracto como justificação.
                    Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ajuste aplicado -- devolve a conta actualizada",
                    content = @Content(schema = @Schema(implementation = AccountResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos, valor zero ou conta não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Saldo disponível insuficiente para o débito",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/accounts/{accountId}/adjust")
    public ResponseEntity<AccountResponse> adjust(
            @PathVariable UUID accountId,
            @Valid @RequestBody AdjustmentRequest request) {
        return ResponseEntity.ok(ledgerService.adjust(accountId, request));
    }

    record ErrorResponse(String message, int status) {}
}
