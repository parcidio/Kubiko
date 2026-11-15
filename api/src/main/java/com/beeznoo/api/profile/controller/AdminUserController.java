package com.beeznoo.api.profile.controller;

import com.beeznoo.api.profile.dto.AdminUserDtos.AdminUserDetail;
import com.beeznoo.api.profile.dto.AdminUserDtos.AdminUserSummary;
import com.beeznoo.api.profile.dto.AdminUserDtos.ModerateUserRequest;
import com.beeznoo.api.profile.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Utilizadores", description = "Pesquisa, ficha e suspensão de contas")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @Operation(summary = "Pesquisar utilizadores", description = """
            `q` procura no nome, no email ou no telefone (dígitos, mínimo 3). `suspended=true` só contas suspensas.
            Mais recentes primeiro. Inclui papel, telefone confirmado, estado do KYC, suspensão e contagens. Apenas ADMIN.
            """)
    @GetMapping
    public ResponseEntity<Page<AdminUserSummary>> search(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean suspended,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // limites aplicados aqui (input do cliente nunca dá 500): q ≤ 100, página ≥ 0, 1–100 por página
        if (q != null && q.length() > 100) throw new IllegalArgumentException("Pesquisa demasiado longa");
        return ResponseEntity.ok(adminUserService.search(q, suspended, Math.max(page, 0), Math.clamp(size, 1, 100)));
    }

    @Operation(summary = "Ficha de um utilizador", description = "Resumo, equipamento e as 10 reservas mais recentes. Apenas ADMIN.")
    @GetMapping("/{id}")
    public ResponseEntity<AdminUserDetail> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(adminUserService.detail(id));
    }

    @Operation(summary = "Suspender conta", description = """
            Revoga as sessões e impede de voltar a entrar; o equipamento sai do Explorar e não recebe pedidos. As
            reservas em curso não mudam. `{ "reason": "..." }` obrigatório (auditoria `ACCOUNT_SUSPENDED`).
            400 para contas ADMIN ou a própria; 409 se já estiver suspensa. Apenas ADMIN.
            """)
    @PostMapping("/{id}/suspend")
    public ResponseEntity<AdminUserSummary> suspend(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                    @Valid @RequestBody ModerateUserRequest request) {
        return ResponseEntity.ok(adminUserService.suspend(adminId, id, request.reason()));
    }

    @Operation(summary = "Reativar conta", description = """
            Levanta a suspensão: volta a poder entrar e o equipamento volta ao Explorar como estava. Motivo opcional
            (auditoria `ACCOUNT_REINSTATED`). 409 se não estiver suspensa. Apenas ADMIN.
            """)
    @PostMapping("/{id}/reinstate")
    public ResponseEntity<AdminUserSummary> reinstate(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                      @Valid @RequestBody(required = false) ModerateUserRequest request) {
        return ResponseEntity.ok(adminUserService.reinstate(adminId, id, request == null ? null : request.reason()));
    }
}
