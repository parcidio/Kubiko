package com.beeznoo.api.kyc.controller;

import com.beeznoo.api.kyc.dto.KycDtos.*;
import com.beeznoo.api.kyc.service.KycService;
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
@RequestMapping("/api/v1/admin/kyc")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · KYC", description = "Fila de verificações de identidade e decisão manual")
public class AdminKycController {

    private final KycService kycService;

    @Operation(
            summary = "Fila de verificações",
            description = """
                    Verificações `PENDING` e `IN_REVIEW`, da mais antiga para a mais recente
                    (pela data da última submissão). Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fila devolvida",
                    content = @Content(schema = @Schema(implementation = KycQueueItem.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<KycQueueItem>> queue(Pageable pageable) {
        return ResponseEntity.ok(kycService.listPending(pageable));
    }

    @Operation(
            summary = "Detalhe da verificação",
            description = """
                    Estado, documentos e histórico de decisões.

                    Cada documento vem com `signedUrl` -- URL pré-assinada válida **5 minutos** (`expiresAt`).
                    Depois disso, volta a pedir o detalhe. Inclui todos os envios (re-submissões incluídas),
                    do mais recente para o mais antigo. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Detalhe devolvido",
                    content = @Content(schema = @Schema(implementation = KycDetailResponse.class))),
            @ApiResponse(responseCode = "400", description = "Verificação não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    public ResponseEntity<KycDetailResponse> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(kycService.getDetail(id));
    }

    @Operation(
            summary = "Decidir verificação",
            description = """
                    Ações (`action`):
                    - `START_REVIEW` -- `PENDING` → `IN_REVIEW`
                    - `APPROVE` -- `PENDING`/`IN_REVIEW` → `APPROVED` (a pessoa passa a poder reservar e publicar)
                    - `REJECT` -- → `REJECTED`; `note` obrigatória (motivo, visível para a pessoa)
                    - `REQUEST_INFO` -- → `INFO_REQUESTED`; `note` obrigatória (o que falta)

                    Cada decisão fica no histórico com autor e data. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Decisão registada -- devolve o novo estado",
                    content = @Content(schema = @Schema(implementation = KycStatusResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos, nota em falta ou verificação não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Transição inválida (ex.: verificação já decidida)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/review")
    public ResponseEntity<KycStatusResponse> review(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewRequest request) {
        return ResponseEntity.ok(kycService.review(adminId, id, request));
    }

    record ErrorResponse(String error) {}
}
