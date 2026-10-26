package com.beeznoo.api.contract.dto;

import com.beeznoo.api.contract.entity.Contract;

import java.time.OffsetDateTime;
import java.util.UUID;

public class ContractDtos {

    public record ContractResponse(
            UUID id,
            UUID bookingId,
            String version,
            String body,
            String bodySha256,
            OffsetDateTime ownerAcceptedAt,
            OffsetDateTime renterAcceptedAt,
            boolean fullyAccepted,
            OffsetDateTime createdAt
    ) {
        public static ContractResponse from(Contract c) {
            return new ContractResponse(
                    c.getId(),
                    c.getBooking().getId(),
                    c.getVersion(),
                    c.getBody(),
                    c.getBodySha256(),
                    c.getOwnerAcceptedAt(),
                    c.getRenterAcceptedAt(),
                    c.isFullyAccepted(),
                    c.getCreatedAt()
            );
        }
    }
}
