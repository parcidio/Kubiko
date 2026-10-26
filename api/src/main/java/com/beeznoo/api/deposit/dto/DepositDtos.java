package com.beeznoo.api.deposit.dto;

import com.beeznoo.api.deposit.entity.Deposit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class DepositDtos {

    public record DepositResponse(
            UUID id,
            UUID bookingId,
            String itemTitle,
            String renterName,
            String ownerName,
            String bookingStatus,
            BigDecimal amount,
            String status,
            BigDecimal withheldAmount,
            String reason,
            OffsetDateTime heldAt,
            OffsetDateTime decidedAt
    ) {
        public static DepositResponse from(Deposit d) {
            var b = d.getBooking();
            return new DepositResponse(
                    d.getId(),
                    b.getId(),
                    b.getItem().getTitle(),
                    b.getRenter().getFullName(),
                    b.getOwner().getFullName(),
                    b.getStatus().name(),
                    d.getAmount(),
                    d.getStatus().name(),
                    d.getWithheldAmount(),
                    d.getReason(),
                    d.getHeldAt(),
                    d.getDecidedAt()
            );
        }
    }

    public record ReleaseRequest(@Size(max = 1000) String reason) {}

    // amount = quanto fica para o dono (parte ou tudo); o resto volta ao arrendatário
    public record WithholdRequest(
            @NotNull @DecimalMin("1") @Digits(integer = 10, fraction = 0) BigDecimal amount,
            @NotBlank @Size(max = 1000) String reason
    ) {}
}
