package com.beeznoo.api.auth.dto;

import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VerifyOptRequest(

        @NotBlank(message = "Número de telefone é obrigatório")
        String phone,

        @NotBlank(message = "Código OTP é Obrigatório")
        String code,

        String fullName,

        String email,

        @NotNull(message = "Papel é obrigatório no registo")
        UserRole role
) {
}
