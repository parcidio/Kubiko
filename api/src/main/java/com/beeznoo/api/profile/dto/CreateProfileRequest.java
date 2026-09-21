package com.beeznoo.api.profile.dto;

import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.apache.catalina.User;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreateProfileRequest(

        @NotBlank(message = "Número de telefone é obrigatório")
        String phone,

        @NotBlank(message = "Nome completo é obrigatório")
        String fullName,

        String email,

        @NotNull(message = "Papel é obrigatório")
        UserRole role
) {}

