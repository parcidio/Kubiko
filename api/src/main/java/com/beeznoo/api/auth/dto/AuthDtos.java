package com.beeznoo.api.auth.dto;

import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    // ---- Registo: passo 1 — dados + envia OTP ----
    public record RegisterRequest(
            @NotBlank String fullName,

            @NotBlank
            @Pattern(regexp = "^\\+244[0-9]{9}$",
                    message = "Número deve estar no formato angolano: +244XXXXXXXXX")
            String phone,

            @Email String email,      // opcional

            @NotBlank
            @Size(min = 8, message = "A password deve ter pelo menos 8 caracteres")
            String password,

            @NotNull UserRole role
    ) {}

    // ---- Registo: passo 2 — confirmar número com OTP ----
    public record VerifyRegistrationRequest(
            @NotBlank String phone,
            @NotBlank String code
    ) {}

    // ---- Login: telefone ou email + password ----
    public record LoginRequest(
            // Um dos dois é obrigatório — validado no serviço
            String phone,
            String email,

            @NotBlank String password
    ) {}

    // ---- Recuperação: passo 1 — pede OTP ----
    public record PasswordResetRequest(
            @NotBlank
            @Pattern(regexp = "^\\+244[0-9]{9}$",
                    message = "Número deve estar no formato angolano: +244XXXXXXXXX")
            String phone
    ) {}

    // ---- Recuperação: passo 2 — confirma OTP + nova password ----
    public record PasswordResetConfirmRequest(
            @NotBlank String phone,
            @NotBlank String code,

            @NotBlank
            @Size(min = 8, message = "A password deve ter pelo menos 8 caracteres")
            String newPassword
    ) {}

    // ---- Refresh token ----
    public record RefreshRequest(
            @NotBlank String refreshToken
    ) {}

    // ---- Resposta após autenticação bem-sucedida ----
    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long expiresIn
    ) {}
}