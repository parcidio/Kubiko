package com.beeznoo.api.profile.dto;

import com.beeznoo.api.profile.entity.Profile;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class MeDtos {

    /**
     * phoneVerified = telefone confirmado por OTP (profiles.is_verified).
     * identityVerified = KYC aprovado (selo "Verificado"). São coisas diferentes.
     */
    public record MeResponse(
            UUID id,
            String fullName,
            String phone,
            String email,
            String avatarUrl,
            String province,
            String city,
            String role,
            String accountType,
            boolean phoneVerified,
            boolean identityVerified,
            String kycStatus,
            BigDecimal ratingAvg,
            OffsetDateTime createdAt
    ) {
        public static MeResponse from(Profile p, String kycStatus) {
            return new MeResponse(
                    p.getId(),
                    p.getFullName(),
                    p.getPhone(),
                    p.getEmail(),
                    p.getAvatarUrl(),
                    p.getProvince(),
                    p.getCity(),
                    p.getRole().name(),
                    p.getAccountType().name(),
                    p.isVerified(),
                    "APPROVED".equals(kycStatus),
                    kycStatus,
                    p.getRatingAvg(),
                    p.getCreatedAt()
            );
        }
    }

    // Campos a null ficam como estão. email "" remove o email. O telefone não se muda aqui (exige OTP).
    public record UpdateMeRequest(
            @Size(min = 2, max = 120) String fullName,
            @Email @Size(max = 254) String email,
            @Size(max = 100) String province,
            @Size(max = 100) String city
    ) {}
}
