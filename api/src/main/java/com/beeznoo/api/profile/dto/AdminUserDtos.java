package com.beeznoo.api.profile.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Admin › Utilizadores (decisoes-produto.md 2026-11-15 — ações de admin). */
public final class AdminUserDtos {

    private AdminUserDtos() {}

    /** Uma linha da pesquisa. kycStatus: estado da verificação mais recente, null se nunca submeteu. */
    public record AdminUserSummary(
            UUID id,
            String fullName,
            String phone,
            String email,
            String role,
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

    public record AdminUserDetail(AdminUserSummary user, String city, List<AdminUserItem> items,
                                  List<AdminUserBooking> recentBookings) {}

    /** Motivo obrigatório para suspender, opcional para reativar (fica na auditoria). */
    public record ModerateUserRequest(@Size(max = 500) String reason) {}

    /** true = promover a ADMIN; false = retirar (volta a BOTH). decisoes-produto.md 2026-11-17. */
    public record ChangeRoleRequest(@NotNull Boolean admin) {}
}
