package com.beeznoo.api.item.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class AvailabilityDtos {

    /** Motivo público: nunca diz quem reservou nem a nota do dono. */
    public enum UnavailableReason { BOOKED, BLOCKED }

    /** Dias indisponíveis, INCLUSIVOS: um dia d está ocupado se start <= d <= end. */
    public record UnavailableRange(LocalDate start, LocalDate end, UnavailableReason reason) {}

    public record AvailabilityResponse(UUID itemId, LocalDate from, LocalDate to, List<UnavailableRange> unavailable) {}

    /** Bloqueio do dono (só o dono vê a nota). Datas inclusivas. */
    public record BlockResponse(UUID id, LocalDate startDate, LocalDate endDate, String note, OffsetDateTime createdAt) {}

    public record CreateBlockRequest(
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @Size(max = 200) String note
    ) {}
}
