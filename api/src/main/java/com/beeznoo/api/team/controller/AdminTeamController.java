package com.beeznoo.api.team.controller;

import com.beeznoo.api.config.AdminAccess;
import com.beeznoo.api.team.dto.TeamDtos.*;
import com.beeznoo.api.team.service.TeamAccessService;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Equipa e acessos", description = "Convites, papéis da equipa e retirar acesso (decisoes-produto.md 2026-11-18)")
public class AdminTeamController {

    private final TeamAccessService teamAccessService;

    @Operation(summary = "O meu acesso", description = "Papel de equipa e permissões de quem tem a sessão. Qualquer ADMIN.")
    @PreAuthorize(AdminAccess.ANY_ADMIN)
    @GetMapping("/access/me")
    public ResponseEntity<MyAccess> me(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(teamAccessService.myAccess(profileId));
    }

    @Operation(summary = "Equipa", description = "Pessoas com acesso ao Admin, com papel e último login de admin. Só SUPER_ADMIN.")
    @PreAuthorize(AdminAccess.TEAM)
    @GetMapping("/team")
    public ResponseEntity<List<TeamMember>> members() {
        return ResponseEntity.ok(teamAccessService.members());
    }

    @Operation(summary = "Mudar o papel de alguém da equipa", description = """
            `{ "adminRole": "OPERATIONS", "reason": "..." }`. 409 `self_change` (o próprio), 409 `last_super_admin`
            (ficaria sem SUPER_ADMIN), 404 `member_not_found`. Auditoria `ADMIN_ROLE_CHANGED`. Só SUPER_ADMIN.
            """)
    @PreAuthorize(AdminAccess.TEAM)
    @PatchMapping("/team/{id}/role")
    public ResponseEntity<TeamMember> changeRole(@AuthenticationPrincipal UUID actorId, @PathVariable UUID id,
                                                 @Valid @RequestBody ChangeAdminRoleRequest request) {
        return ResponseEntity.ok(teamAccessService.changeRole(actorId, id, request.adminRole(), request.reason()));
    }

    @Operation(summary = "Retirar acesso ao Admin", description = """
            A conta volta a "dono e arrendatário" e as sessões são revogadas. Motivo obrigatório. 409 `self_change`,
            409 `last_super_admin`. Auditoria `ADMIN_ACCESS_REVOKED`. Só SUPER_ADMIN.
            """)
    @PreAuthorize(AdminAccess.TEAM)
    @PostMapping("/team/{id}/revoke")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal UUID actorId, @PathVariable UUID id,
                                       @Valid @RequestBody ReasonRequest request) {
        teamAccessService.revokeAccess(actorId, id, request.reason());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Convites", description = "Do mais recente para o mais antigo, com estado. Só SUPER_ADMIN.")
    @PreAuthorize(AdminAccess.TEAM)
    @GetMapping("/team/invitations")
    public ResponseEntity<Page<InvitationResponse>> invitations(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(teamAccessService.invitations(Math.max(page, 0), Math.clamp(size, 1, 100)));
    }

    @Operation(summary = "Convidar para a equipa", description = """
            `{ "userId": "…" }` ou `{ "email": "…" }`, mais `adminRole` e nota opcional. Válido 72 h, uso único.
            A resposta traz `inviteUrl` **uma vez** (o token só fica guardado em hash). 409 `already_admin`,
            `account_suspended`, `invite_pending`, `self_change`. Auditoria `ADMIN_INVITED`. Só SUPER_ADMIN.
            """)
    @PreAuthorize(AdminAccess.TEAM)
    @PostMapping("/team/invitations")
    public ResponseEntity<InvitationResponse> invite(@AuthenticationPrincipal UUID actorId,
                                                     @Valid @RequestBody InviteRequest request) {
        return ResponseEntity.ok(teamAccessService.invite(actorId, request));
    }

    @Operation(summary = "Cancelar convite", description = "409 `invitation_not_pending`. Auditoria `ADMIN_INVITATION_REVOKED`. Só SUPER_ADMIN.")
    @PreAuthorize(AdminAccess.TEAM)
    @PostMapping("/team/invitations/{id}/revoke")
    public ResponseEntity<InvitationResponse> revokeInvitation(@AuthenticationPrincipal UUID actorId, @PathVariable UUID id,
                                                               @Valid @RequestBody ReasonRequest request) {
        return ResponseEntity.ok(teamAccessService.revokeInvitation(actorId, id, request.reason()));
    }
}
