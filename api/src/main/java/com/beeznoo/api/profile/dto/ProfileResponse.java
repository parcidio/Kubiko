package com.beeznoo.api.profile.dto;

import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProfileResponse (
        UUID id,
        String phone,
        String fullName,
        String email,
        String avatarUrl,
        String province,
        String city,
        UserRole role,
        boolean isVerified,
        boolean hasGoogleLinked,
        BigDecimal ratingAvg,
        OffsetDateTime createdAt
) {
    public static ProfileResponse from(Profile profile) {
        return new ProfileResponse(
                profile.getId(),
                profile.getPhone(),
                profile.getFullName(),
                profile.getEmail(),
                profile.getAvatarUrl(),
                profile.getProvince(),
                profile.getCity(),
                profile.getRole(),
                profile.isVerified(),
                profile.getGoogleId() != null,
                profile.getRatingAvg(),
                profile.getCreatedAt()
        );
    }
}
