package com.beeznoo.api.team.dto;

import com.beeznoo.api.profile.entity.AdminPermission;
import com.beeznoo.api.profile.entity.AdminRole;
import com.beeznoo.api.team.entity.AdminInvitation.InvitationStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Equipa e acessos ao Admin (decisoes-produto.md 2026-11-18). */
public final class TeamDtos {

    private TeamDtos() {}

    /** O que a pessoa com sessão pode fazer no Admin (o frontend esconde áreas; a API decide). */
    public record MyAccess(UUID profileId, String fullName, AdminRole adminRole, List<AdminPermission> permissions) {}

    public record TeamMember(UUID id, String fullName, String phone, String email, AdminRole adminRole,
                             OffsetDateTime createdAt, OffsetDateTime lastAdminLoginAt) {}

    /** Alvo: userId (conta existente) OU email. */
    public record InviteRequest(
            UUID userId,
            @Email @Size(max = 255) String email,
            @NotNull AdminRole adminRole,
            @Size(max = 500) String note
    ) {}

    /**
     * inviteUrl só vem na resposta de criar (o token não é guardado em claro): mostra-se uma vez a quem convida.
     * targetName: nome da conta convidada, quando é uma conta existente.
     */
    public record InvitationResponse(UUID id, UUID userId, String targetName, String emailMasked, AdminRole adminRole,
                                     String note, InvitationStatus status, String invitedByName,
                                     OffsetDateTime createdAt, OffsetDateTime expiresAt, OffsetDateTime acceptedAt,
                                     OffsetDateTime revokedAt, String inviteUrl, boolean emailSent) {}

    public record TokenRequest(@NotBlank @Size(min = 20, max = 200) String token) {}

    /** Antes de aceitar: o que o convite dá e se é para quem tem a sessão. */
    public record InvitationPreview(AdminRole adminRole, String invitedByName, OffsetDateTime expiresAt,
                                    InvitationStatus status, boolean forYou, String problem) {}

    /** Depois de aceitar: tem de entrar outra vez (2FA de admin) para ter um token com o papel novo. */
    public record AcceptResponse(AdminRole adminRole, boolean reauthRequired) {}

    public record ChangeAdminRoleRequest(@NotNull AdminRole adminRole,
                                         @NotBlank @Size(min = 5, max = 500) String reason) {}

    public record ReasonRequest(@NotBlank @Size(min = 5, max = 500) String reason) {}
}
