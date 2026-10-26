package com.beeznoo.api.handover.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class ChecklistDtos {

    public record ChecklistPhotoResponse(UUID id, String url, int position) {}

    // As URLs das fotos expiram em photosExpireAt (10 min)
    public record ChecklistResponse(
            UUID id,
            UUID bookingId,
            String type,
            UUID createdById,
            String createdByName,
            String notes,
            List<ChecklistPhotoResponse> photos,
            OffsetDateTime photosExpireAt,
            boolean confirmed,
            UUID confirmedById,
            OffsetDateTime confirmedAt,
            OffsetDateTime createdAt
    ) {}
}
