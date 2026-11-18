package com.beeznoo.api.profile.controller;

import com.beeznoo.api.audit.dto.AuditDtos.AuditLogResponse;
import com.beeznoo.api.config.AdminAccess;
import com.beeznoo.api.profile.dto.AdminUserDtos.*;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.service.AdminUserService;
import com.beeznoo.api.profile.service.AdminUserService.UserSearch;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Admin › Utilizadores (decisoes-produto.md 2026-11-18). O acesso ao Admin não se dá aqui: só por convite
 * (AdminTeamController). Ações sensíveis com motivo obrigatório e auditoria.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Utilizadores", description = "Pesquisa, ficha, ações sobre contas e notas internas")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @Operation(summary = "Pesquisar utilizadores", description = """
            `q` procura no nome, no email ou no telefone (dígitos, mínimo 3). Filtros: `role` (OWNER, RENTER, BOTH,
            ADMIN), `kyc` (NONE, PENDING, IN_REVIEW, INFO_REQUESTED, APPROVED, REJECTED), `status` (ACTIVE,
            SUSPENDED), `phoneVerified`, `createdFrom`/`createdTo` (AAAA-MM-DD, fuso de Luanda). `sort`: createdAt
            (omissão), name, items; `direction`: asc/desc. `suspended=true` mantém-se por compatibilidade.
            Permissão USERS_READ.
            """)
    @PreAuthorize(AdminAccess.USERS_READ)
    @GetMapping
    public ResponseEntity<Page<AdminUserSummary>> search(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean suspended,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) String kyc,
            @RequestParam(required = false) Boolean phoneVerified,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        // limites aplicados aqui (input do cliente nunca dá 500): q ≤ 100, página ≥ 0, 1–100 por página
        if (q != null && q.length() > 100) throw new IllegalArgumentException("Pesquisa demasiado longa");
        Boolean suspendedFilter = suspended ? Boolean.TRUE : null;
        if (status != null && !status.isBlank()) {
            suspendedFilter = switch (status) {
                case "ACTIVE" -> Boolean.FALSE;
                case "SUSPENDED" -> Boolean.TRUE;
                default -> throw new IllegalArgumentException("Estado inválido (ACTIVE ou SUSPENDED)");
            };
        }
        String kycFilter = kyc == null || kyc.isBlank() ? null : kyc;
        UserSearch search = new UserSearch(q, role, kycFilter, suspendedFilter, phoneVerified, createdFrom, createdTo, sort, direction);
        return ResponseEntity.ok(adminUserService.search(search, Math.clamp(page, 0, 100_000), Math.clamp(size, 1, 100)));
    }

    @Operation(summary = "Ficha de um utilizador", description = """
            Resumo, KYC mais recente (sem documentos), sessões ativas, equipamento e as 10 reservas mais recentes.
            404 `user_not_found`. Permissão USERS_READ.
            """)
    @PreAuthorize(AdminAccess.USERS_READ)
    @GetMapping("/{id}")
    public ResponseEntity<AdminUserDetail> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(adminUserService.detail(id));
    }

    @Operation(summary = "Histórico da conta", description = """
            Auditoria das decisões sobre a conta, as verificações e o equipamento dela, da mais recente para a mais
            antiga. Permissão USERS_READ.
            """)
    @PreAuthorize(AdminAccess.USERS_READ)
    @GetMapping("/{id}/history")
    public ResponseEntity<Page<AuditLogResponse>> history(@PathVariable UUID id,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminUserService.history(id, Math.clamp(page, 0, 100_000), Math.clamp(size, 1, 100)));
    }

    @Operation(summary = "Notas internas", description = "Só a equipa vê. Mais recentes primeiro. Permissão USERS_READ.")
    @PreAuthorize(AdminAccess.USERS_READ)
    @GetMapping("/{id}/notes")
    public ResponseEntity<List<AdminUserNote>> notes(@PathVariable UUID id) {
        return ResponseEntity.ok(adminUserService.notes(id));
    }

    @Operation(summary = "Acrescentar nota interna", description = """
            `{ "body": "..." }` (até 2000 caracteres). Não se edita nem apaga. Auditoria `USER_NOTE_ADDED` (sem o texto).
            Permissão USERS_NOTE.
            """)
    @PreAuthorize(AdminAccess.USERS_NOTE)
    @PostMapping("/{id}/notes")
    public ResponseEntity<AdminUserNote> addNote(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                 @Valid @RequestBody NoteRequest request) {
        return ResponseEntity.ok(adminUserService.addNote(adminId, id, request.body()));
    }

    @Operation(summary = "Suspender conta", description = """
            Revoga as sessões e impede de voltar a entrar; o equipamento sai do Explorar e não recebe pedidos. As
            reservas em curso não mudam. Motivo obrigatório (auditoria `ACCOUNT_SUSPENDED`). 409 `team_account`,
            `self_action`, `already_suspended`. Permissão USERS_MANAGE.
            """)
    @PreAuthorize(AdminAccess.USERS_MANAGE)
    @PostMapping("/{id}/suspend")
    public ResponseEntity<AdminUserSummary> suspend(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                    @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(adminUserService.suspend(adminId, id, request.reason()));
    }

    @Operation(summary = "Reativar conta", description = """
            Levanta a suspensão. Motivo obrigatório (auditoria `ACCOUNT_REINSTATED`). 409 `not_suspended`.
            Permissão USERS_MANAGE.
            """)
    @PreAuthorize(AdminAccess.USERS_MANAGE)
    @PostMapping("/{id}/reinstate")
    public ResponseEntity<AdminUserSummary> reinstate(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                      @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(adminUserService.reinstate(adminId, id, request.reason()));
    }

    @Operation(summary = "Terminar sessões", description = """
            Revoga todas as sessões (o token de acesso já emitido dura ≤ 15 min). Motivo obrigatório (auditoria
            `SESSIONS_REVOKED`). 409 `self_action`. Permissão USERS_MANAGE.
            """)
    @PreAuthorize(AdminAccess.USERS_MANAGE)
    @PostMapping("/{id}/sessions/revoke")
    public ResponseEntity<AdminUserSummary> revokeSessions(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                           @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(adminUserService.revokeSessions(adminId, id, request.reason()));
    }

    @Operation(summary = "Repor confirmação do telefone", description = """
            Obriga a confirmar o número outra vez (no próximo login recebe um código). Termina as sessões. Motivo
            obrigatório (auditoria `PHONE_VERIFICATION_RESET`). 409 `team_account`, `self_action`,
            `phone_not_verified`. Permissão USERS_MANAGE.
            """)
    @PreAuthorize(AdminAccess.USERS_MANAGE)
    @PostMapping("/{id}/phone-verification/reset")
    public ResponseEntity<AdminUserSummary> resetPhone(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                       @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(adminUserService.resetPhoneVerification(adminId, id, request.reason()));
    }
}
