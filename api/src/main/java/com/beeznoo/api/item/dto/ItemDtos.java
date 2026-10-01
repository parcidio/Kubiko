package com.beeznoo.api.item.dto;

import com.beeznoo.api.item.entity.ItemCondition;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class ItemDtos {

    public record PublishItemRequest(
            @NotBlank @Size(max = 200) String title,
            String description,
            @NotNull UUID categoryId,
            @NotNull ItemCondition itemCondition,
            @NotNull @DecimalMin("0.01") BigDecimal pricePerDay,
            @DecimalMin("0.01") BigDecimal depositAmount,
            @Size(max = 100) String province,
            @Size(max = 100) String city
            ) {}

    public record UpdateItemRequest(
            @Size(max = 200) String title,
            String description,
            ItemCondition condition,
            @DecimalMin("0.01") BigDecimal pricePerDay,
            @DecimalMin("0.01") BigDecimal depositAmount,
            @Size(max = 100) String province,
            @Size(max = 100) String city
    ) {}

    public record CategoryResponse(
            UUID id,
            String name,
            String slug,
            String iconUrl,
            UUID parentId
    ) {}

    public record PhotoResponse(
            UUID id,
            String photUrl,
            int position
    ) {}

    public record ItemResponse(
            UUID id,
            UUID ownerId,
            String ownerName,
            CategoryResponse category,
            String title,
            String description,
            String condition,
            BigDecimal pricePerDay,
            BigDecimal depositAmount,
            String province,
            String city,
            String status,
            int viewCount,
            List<PhotoResponse> photos,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {}


}


