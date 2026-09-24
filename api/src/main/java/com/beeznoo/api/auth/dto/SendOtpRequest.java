package com.beeznoo.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record SendOtpRequest(

        @NotBlank(message = "Número de telefone é obrigatório")
        @Pattern(
                regexp = "^\\+244[0-9]{9}$",
                message = "Número deve estar no formato angolano +2449XXXXXXXX"
        )
        String phone
) {}

