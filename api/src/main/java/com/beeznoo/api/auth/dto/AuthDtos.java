package com.beeznoo.api.auth.dto;

import com.beeznoo.api.common.util.Phones;
import com.beeznoo.api.profile.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    // Angola: +244 e 9 dígitos. Estrangeiros (decisoes-produto.md 2026-11-17): E.164, 8–15 dígitos, OTP só por WhatsApp
    static final String PHONE = "^(\\+244[0-9]{9}|\\+(?!244)[1-9][0-9]{7,14})$";
    static final String PHONE_MESSAGE = "Número em formato internacional: +244XXXXXXXXX ou +<indicativo><número>";
    static final String OTP = "^[0-9]{6}$";

    // ---- Registo: passo 1 — dados + envia OTP ----
    public record RegisterRequest(
            @NotBlank @Size(max = 120) String fullName,

            @NotBlank
            @Pattern(regexp = PHONE, message = PHONE_MESSAGE)
            String phone,

            @Email @Size(max = 254) String email,      // opcional

            @NotBlank
            @Size(min = 8, max = 72, message = "A password deve ter entre 8 e 72 caracteres")
            String password,

            @NotNull UserRole role,

            // opcional: localização com consentimento (arredondada a ~1 km); recusar não bloqueia o registo
            @jakarta.validation.Valid com.beeznoo.api.geo.dto.GeoDtos.LocationInput location
    ) {
        public RegisterRequest {
            phone = Phones.normalize(phone);
        }

        public RegisterRequest(String fullName, String phone, String email, String password, UserRole role) {
            this(fullName, phone, email, password, role, null);
        }
    }

    // ---- Registo: passo 2 — confirmar número com OTP ----
    public record VerifyRegistrationRequest(
            @NotBlank @Pattern(regexp = PHONE) String phone,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code
    ) {
        public VerifyRegistrationRequest {
            phone = Phones.normalize(phone);
        }
    }

    // ---- Login: telefone ou email + password ----
    public record LoginRequest(
            // Um dos dois é obrigatório — validado no serviço
            @Size(max = 20) String phone,
            @Size(max = 254) String email,

            @NotBlank @Size(max = 128) String password
    ) {
        public LoginRequest {
            phone = Phones.normalize(phone);
        }
    }

    // ---- Recuperação: passo 1 — pede OTP ----
    public record PasswordResetRequest(
            @NotBlank
            @Pattern(regexp = PHONE, message = PHONE_MESSAGE)
            String phone
    ) {
        public PasswordResetRequest {
            phone = Phones.normalize(phone);
        }
    }

    // ---- Recuperação: passo 2 — confirma OTP + nova password ----
    public record PasswordResetConfirmRequest(
            @NotBlank @Pattern(regexp = PHONE) String phone,
            @NotBlank @Pattern(regexp = OTP, message = "O código tem 6 dígitos") String code,

            @NotBlank
            @Size(min = 8, max = 72, message = "A password deve ter entre 8 e 72 caracteres")
            String newPassword
    ) {
        public PasswordResetConfirmRequest {
            phone = Phones.normalize(phone);
        }
    }

    // ---- Registo via Google: passo 1 — submete telefone + role, envia OTP ----
    public record GoogleRegisterRequest(
            @NotBlank @Size(max = 64) String pendingToken,

            @NotBlank
            @Pattern(regexp = PHONE, message = PHONE_MESSAGE)
            String phone,

            @NotNull UserRole role
    ) {
        public GoogleRegisterRequest {
            phone = Phones.normalize(phone);
        }
    }

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