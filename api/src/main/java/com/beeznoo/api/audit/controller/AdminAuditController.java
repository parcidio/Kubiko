package com.beeznoo.api.audit.controller;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.audit.service.AuditService;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Auditoria", description = "Registo das ações sensíveis da equipa")
public class AdminAuditController {

    private final AuditService auditService;

    @Operation(
            summary = "Registo de auditoria",
            description = """
                    Ações sensíveis (KYC, pagamentos, ajustes de saldo, cauções, problemas), da mais recente para a
                    mais antiga. Filtrar por entidade com `entityType` (`BOOKING`, `KYC`, `ACCOUNT`, `INCIDENT`)
                    e `entityId`. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Registos devolvidos",
                    content = @Content(schema = @Schema(implementation = AuditLogResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            Pageable pageable) {
        return ResponseEntity.ok(auditService.list(entityType, entityId, pageable));
    }

    record ErrorResponse(String error) {}
}
