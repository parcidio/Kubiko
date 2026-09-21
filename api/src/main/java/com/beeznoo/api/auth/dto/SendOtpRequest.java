package com.beeznoo.api.auth.dto;

import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record SendOtpRequest(

        @NotBlank(message = "Número de telefone é obrigatório")
        @Pattern(
                regexp = "^\\+244[0-9]{9}$",
                message = "Número deve estar no formato angolano +2449XXXXXXXX"
        )
        String phone
) {}

record VerifyOptRequest(

        @NotBlank(message = "Número de telefone é obrigatório")
        String photo,

        @NotBlank(message = "Código OTP é Obrigatório")
        String code,

        String fullName,

        String email,

        @NotNull(message = "Papel é obrigatório no registo")
        UserRole role
) {}

record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresIn
) {}

record RefreshRequest(
        @NotBlank(message = "Refresh token é obrigatório")
        String refreshToken
) {}
