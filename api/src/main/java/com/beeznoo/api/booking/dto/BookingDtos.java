package com.beeznoo.api.booking.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public class BookingDtos {

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
            UUID ownerId,
            String ownerName,
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
