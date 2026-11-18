package com.beeznoo.api.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Admin › Utilizadores (decisoes-produto.md 2026-11-15 e 2026-11-18). */
public final class AdminUserDtos {

    private AdminUserDtos() {}

    /**
     * Uma linha da pesquisa. kycStatus: estado da verificação mais recente, null se nunca submeteu.
     * adminRole: papel de equipa (só para role ADMIN).
     */
    public record AdminUserSummary(
            UUID id,
            String fullName,
            String phone,
            String email,
            String role,
            String adminRole,
            boolean phoneVerified,
            String kycStatus,
            OffsetDateTime createdAt,
            OffsetDateTime suspendedAt,
            String suspensionReason,
            long items,
            long bookingsAsRenter,
            long bookingsAsOwner
    ) {}

    public record AdminUserItem(UUID id, String title, String status, long pricePerDay, boolean featured) {}

    public record AdminUserBooking(UUID id, String itemTitle, String side, String status,
                                   LocalDate startDate, LocalDate endDate, OffsetDateTime createdAt) {}

    /** KYC mais recente (sem documentos: esses só em Verificações, por URL assinada). */
    public record AdminUserKyc(UUID id, String status, String accountType, OffsetDateTime submittedAt,
                               OffsetDateTime reviewedAt) {}

    /**
     * Ficha. activeSessions: refresh tokens válidos; lastSessionAt: início da sessão mais recente.
     * emailVerified: email confirmado por código. avatarUrl: URL assinada de curta duração, a do Google, ou null (iniciais).
     */
    public record AdminUserDetail(AdminUserSummary user, String city, String province, String avatarUrl, boolean emailVerified,
                                  String accountType, String suspendedByName, long activeSessions,
                                  OffsetDateTime lastSessionAt, AdminUserKyc kyc, List<AdminUserItem> items,
                                  List<AdminUserBooking> recentBookings, long notes) {}

    public record AdminUserNote(UUID id, String body, UUID authorId, String authorName, OffsetDateTime createdAt) {}

    public record NoteRequest(@NotBlank @Size(max = 2000) String body) {}

    /** Motivo obrigatório (fica na auditoria). */
    public record ReasonRequest(@NotBlank(message = "Indica o motivo") @Size(min = 5, max = 500) String reason) {}

    /** Motivo opcional, só por compatibilidade (reativar passou a exigir motivo). */
    public record ModerateUserRequest(@Size(max = 500) String reason) {}
}
