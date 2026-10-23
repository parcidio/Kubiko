package com.beeznoo.api.auth.dto;

import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    static final String PHONE = "^\\+244[0-9]{9}$";
    static final String OTP = "^[0-9]{6}$";

    // ---- Registo: passo 1 — dados + envia OTP ----
    public record RegisterRequest(
            @NotBlank @Size(max = 120) String fullName,

            @NotBlank
            @Pattern(regexp = "^\\+244[0-9]{9}$",
                    message = "Número deve estar no formato angolano: +244XXXXXXXXX")
            String phone,

            @Email @Size(max = 254) String email,      // opcional

            @NotBlank
            @Size(min = 8, max = 72, message = "A password deve ter entre 8 e 72 caracteres")
            String password,

            @NotNull UserRole role
    ) {}

    // ---- Registo: passo 2 — confirmar número com OTP ----
    public record VerifyRegistrationRequest(
            @NotBlank @Pattern(regexp = PHONE) String phone,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code
    ) {}

    // ---- Login: telefone ou email + password ----
    public record LoginRequest(
            // Um dos dois é obrigatório — validado no serviço
            @Size(max = 20) String phone,
            @Size(max = 254) String email,

            @NotBlank @Size(max = 128) String password
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
            @NotBlank @Pattern(regexp = PHONE) String phone,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code,

            @NotBlank
            @Size(min = 8, max = 72, message = "A password deve ter entre 8 e 72 caracteres")
            String newPassword
    ) {}

    // ---- Registo via Google: passo 1 — submete telefone + role, envia OTP ----
    public record GoogleRegisterRequest(
            @NotBlank @Size(max = 64) String pendingToken,

            @NotBlank
            @Pattern(regexp = "^\\+244[0-9]{9}$",
                    message = "Número deve estar no formato angolano: +244XXXXXXXXX")
            String phone,

            @NotNull UserRole role
    ) {}

    // ---- Registo via Google: passo 2 — confirma número com OTP, cria o perfil ----
    public record GoogleVerifyRequest(
            @NotBlank @Size(max = 64) String pendingToken,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code
    ) {}

    // ---- Login Google: código de uso único do redirect → tokens ----
    public record GoogleExchangeRequest(
            @NotBlank @Size(max = 100) String code
    ) {}

    // ---- Refresh token ----
    // Cliente web: corpo vazio — o refresh vem no cookie httpOnly bz_refresh
    public record RefreshRequest(
            @Size(max = 200) String refreshToken
    ) {}

    // ---- Resposta após autenticação bem-sucedida ----
    // mfaRequired = true (contas ADMIN): sem tokens; foi enviado um código por SMS → POST /auth/login/mfa.
    // Cliente web (X-Beeznoo-Client: web): refreshToken vem a null — vai no cookie httpOnly bz_refresh.
    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            boolean mfaRequired,
            String mfaPhoneHint,
            // desafio opaco (10 min, uso único) a enviar com o código em POST /auth/login/mfa
            String mfaToken
    ) {
        public AuthResponse(String accessToken, String refreshToken, long expiresIn) {
            this(accessToken, refreshToken, expiresIn, false, null, null);
        }

        public static AuthResponse mfa(String phoneHint, String mfaToken) {
            return new AuthResponse(null, null, 0, true, phoneHint, mfaToken);
        }

        public AuthResponse withoutRefreshToken() {
            return new AuthResponse(accessToken, null, expiresIn, mfaRequired, mfaPhoneHint, mfaToken);
        }
    }

    // ---- 2FA de admin: código recebido por SMS depois da password (ou do Google) ----
    public record AdminMfaRequest(
            @NotBlank @Size(max = 100) String mfaToken,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code
    ) {}

    // ---- Mudar password com sessão iniciada ----
    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(min = 8, max = 72, message = "A password deve ter entre 8 e 72 caracteres") String newPassword
    ) {}
}