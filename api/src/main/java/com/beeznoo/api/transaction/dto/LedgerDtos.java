package com.beeznoo.api.transaction.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class LedgerDtos {

    public record AccountResponse(
            UUID id,
            BigDecimal availableBalance,
            BigDecimal heldBalance,
            String currency,
            OffsetDateTime updatedAt
    ) {}

    public record LedgerEntryResponse(
            UUID id,
            String type,
            BigDecimal amount,
            BigDecimal balanceAfter,
            String description,
            OffsetDateTime createdAt
    ) {}

    // Positivo credita, negativo debita o saldo disponível
    public record AdjustmentRequest(
            @NotNull @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @NotBlank @Size(max = 1000) String description
    ) {}
}
