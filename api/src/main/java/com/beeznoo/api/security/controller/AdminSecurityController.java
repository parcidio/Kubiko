package com.beeznoo.api.security.controller;

import com.beeznoo.api.security.dto.SecurityEventDtos.SecurityEventResponse;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.service.SecurityEventService;
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
@RequestMapping("/api/v1/admin/security-events")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Segurança", description = "Eventos de segurança (logins bloqueados, OTP, refresh roubado, 2FA)")
public class AdminSecurityController {

    private final SecurityEventService securityEventService;

    @Operation(
            summary = "Eventos de segurança",
            description = """
                    Do mais recente para o mais antigo. Filtrar por `severity` (`LOW`, `MEDIUM`, `HIGH`).
                    Sem telefones nem emails em claro (só o SHA-256). Eventos `HIGH` também geram um alerta. Apenas ADMIN.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Eventos devolvidos",
                    content = @Content(schema = @Schema(implementation = SecurityEventResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<Page<SecurityEventResponse>> list(
            @RequestParam(required = false) SecurityEventType.Severity severity,
            Pageable pageable) {
        return ResponseEntity.ok(securityEventService.list(severity, pageable));
    }

    record ErrorResponse(String error) {}
}
