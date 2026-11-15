package com.beeznoo.api.booking.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class BookingDtos {

    // Admin confirma o pagamento. Modo direct: channel obrigatório (como o dono recebeu) e reason obrigatório
    public record ConfirmPaymentRequest(
            @jakarta.validation.constraints.Size(max = 500) String reason,
            com.beeznoo.api.transaction.entity.DirectChannel channel
    ) {}

    // Modo direct: o dono indica o que fez com a caução. withheldAmount 0 ou vazio = devolveu tudo
    public record DepositDecisionRequest(
            @jakarta.validation.constraints.PositiveOrZero java.math.BigDecimal withheldAmount,
            @jakarta.validation.constraints.Size(max = 500) String reason
    ) {}

    public record CreateBookingRequest(
            @NotNull UUID itemId,
            @NotNull @FutureOrPresent LocalDate startDate,
            @NotNull @Future LocalDate endDate,
            @Size(max = 1000) String renterMessage
    ) {}

    public record BookingActionRequest(
            @Size(max = 1000) String ownerNote
    ) {}

    public record BookingResponse(
            UUID id,
            UUID itemId,
            String itemTitle,
            String itemCoverPhoto,
            UUID renterId,
            String renterName,
            boolean renterVerified,
            UUID ownerId,
            String ownerName,
            boolean ownerVerified,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal totalPrice,
            BigDecimal depositAmount,
            String status,
            String renterMessage,
            String ownerNote,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {}
}
