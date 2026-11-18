package com.beeznoo.api.team.controller;

import com.beeznoo.api.team.dto.TeamDtos.AcceptResponse;
import com.beeznoo.api.team.dto.TeamDtos.InvitationPreview;
import com.beeznoo.api.team.dto.TeamDtos.TokenRequest;
import com.beeznoo.api.team.service.TeamAccessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Lado de quem é convidado: qualquer sessão (ainda não é admin). O token vai sempre no corpo, nunca no URL. */
@RestController
@RequestMapping("/api/v1/team-access/invitations")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Convites para a equipa", description = "Ver e aceitar um convite (decisoes-produto.md 2026-11-18)")
public class TeamInvitationController {

    private final TeamAccessService teamAccessService;

    @Operation(summary = "Ver um convite", description = """
            `{ "token": "…" }` (o token vem do fragmento do link). Devolve o papel, quem convidou, validade e se é para
            esta conta (`forYou`, ou `problem` com o código). 404 `invitation_invalid`.
            """)
    @PostMapping("/inspect")
    public ResponseEntity<InvitationPreview> inspect(@AuthenticationPrincipal UUID profileId,
                                                     @Valid @RequestBody TokenRequest request) {
        return ResponseEntity.ok(teamAccessService.inspect(profileId, request.token()));
    }

    @Operation(summary = "Aceitar um convite", description = """
            Dá o papel de equipa e revoga as sessões: entra outra vez (com 2FA de admin). 409 com `code`:
            `invitation_used`, `invitation_revoked`, `invitation_expired`, `already_admin`, `account_suspended`,
            `phone_unverified`, `email_unverified`, `not_for_you`. Auditoria `ADMIN_INVITATION_ACCEPTED`.
            """)
    @PostMapping("/accept")
    public ResponseEntity<AcceptResponse> accept(@AuthenticationPrincipal UUID profileId,
                                                 @Valid @RequestBody TokenRequest request) {
        return ResponseEntity.ok(teamAccessService.accept(profileId, request.token()));
    }
}
