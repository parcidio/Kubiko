package com.beeznoo.api.claim.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class IncidentDtos {

    public record IncidentPhotoResponse(UUID id, String url, int position) {}

    // photos: URLs assinadas válidas até photosExpireAt (10 min)
    public record IncidentResponse(
            UUID id,
            UUID bookingId,
            String itemTitle,
            String bookingStatus,
            UUID reporterId,
            String reporterName,
            String type,
            String description,
            String status,
            String resolutionNote,
            OffsetDateTime resolvedAt,
            List<IncidentPhotoResponse> photos,
            OffsetDateTime photosExpireAt,
            OffsetDateTime createdAt
    ) {}

    public record ResolveRequest(@NotBlank @Size(max = 2000) String note) {}
}
