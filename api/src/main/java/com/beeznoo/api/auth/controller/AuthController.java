package com.beeznoo.api.auth.controller;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.service.AuthService;
import com.beeznoo.api.common.security.SecurityProperties;
import com.beeznoo.api.config.JwtProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Registo, login e recuperação de password")
public class AuthController {

    // Cliente web: refresh em cookie httpOnly (não fica acessível a JavaScript — XSS). Ver docs/SEGURANCA.md.
    static final String REFRESH_COOKIE = "bz_refresh";
    static final String CLIENT_HEADER = "X-Beeznoo-Client";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final AuthService authService;
    private final SecurityProperties securityProperties;
    private final JwtProperties jwtProperties;

    @Operation(
            summary = "Registo - passo 1",
            description = """
                    Cria o perfil com os dados fornecidos e envia um OTP por SMS
                    para confirmar o número de telefone. O perfil fica inativo até
                    o número ser verificado no passo 2.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Dados Guardados e OTP enviado"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Número de telefone já registado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/register")
    public ResponseEntity<Void> sendOtp(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Registo - passo 2",
            description = """
                    Confirma o número de telefone com OTP recebido por SMS.
                    Após verificação bem-sucedida, o perfil fica ativo e são
                    emitidos os tokens de secção.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Número verificado - tokens emitidos",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código inválido ou expirado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/register/verify")
    public ResponseEntity<AuthResponse> verifyOtp(@Valid @RequestBody VerifyRegistrationRequest request,
                                                  HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.verifyRegistration(request), http, response);
    }

    @Operation(
            summary = "Login",
            description = """
                    Autentica com o número de telefone ou email + password.
                    Pelo menos um dos dois é (`phone` ou `email`) obrigatório
                    
                    Devolve:
                    - `accessToken` -- JWT, válido até 15 minutos
                    - `refreshToken` -- válido até 30 dias, rotacionado em cada refresh
                    - `expiresIn` -- segundos até o access token expirar
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autenticado com sucesso",
            content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Credenciais inválidas ou conta não verificada",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.login(request), http, response);
    }

    @Operation(
            summary = "Recuperar password - passo 1",
            description = """
                    Envia um OTP por SMS para o número indicado.
                    Responde sempre 204 - não revela se o número existe ou não.
                    """
    )
    @ApiResponse(responseCode = "204", description = "OTP enviado (se o número existir)")
    @PostMapping("/password/reset/request")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        authService.requestPassword(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Recuperar password - passo 2",
            description = """
                    Confirma o OTP e define uma nova password.
                    Todos os refresh tokens existentes são revogadas após a mudanças.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Password redefinida com sucesso"),
            @ApiResponse(responseCode = "400", description = "Código inválido ou expirado",
            content = @Content(schema = @Schema(implementation = Error.class)))
    })
    @PostMapping("/password/reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        authService.confirmPasswordReset(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Renovar access token",
            description = "O refresh token é rotacionado - guardar sempre o mais recente."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tokens renovados",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "401", description = "Refresh token inválido ou expirado")
    })
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody(required = false) RefreshRequest request,
                                                HttpServletRequest http, HttpServletResponse response) {
        String raw = request != null && request.refreshToken() != null && !request.refreshToken().isBlank()
                ? request.refreshToken() : readRefreshCookie(http);
        if (raw == null) throw new IllegalArgumentException("Sessão expirada. Entra outra vez.");
        return tokens(authService.refresh(raw), http, response);
    }

    @Operation(
            summary = "Logout",
            description = "Revoga todos os refresh tokens. Requer bearer. "
    )
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Logout bem-sucedido"),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Principal principal, HttpServletResponse response) {
        authService.logout(UUID.fromString(principal.getName()));
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString());
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Login Google — trocar código por tokens",
            description = """
                    Depois do login Google, o redirect para `/oauth2/callback?status=success&code=…` traz um código
                    de **uso único válido 60 s** (os tokens nunca vão na URL). O frontend troca-o aqui por tokens.
                    Outros estados do redirect: `pending_phone` (falta o telefone), `email_in_use` (o email do Google
                    já pertence a uma conta — entrar com telefone), `error`.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tokens emitidos",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código inválido, expirado ou já usado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "429", description = "Demasiados pedidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/google/exchange")
    public ResponseEntity<AuthResponse> exchangeGoogleCode(@Valid @RequestBody GoogleExchangeRequest request,
                                                           HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.exchangeLoginCode(request.code()), http, response);
    }

    @Operation(
            summary = "Login de admin — 2.º passo (2FA)",
            description = """
                    Contas ADMIN: o login (password ou Google) responde `mfaRequired: true` e um `mfaToken` (10 min),
                    sem tokens, e envia um código por SMS para o telefone da conta. Este pedido troca
                    `{ mfaToken, code }` por tokens.
                    5 erros no mesmo código bloqueiam-no e geram um alerta de segurança.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tokens emitidos",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código inválido, expirado ou bloqueado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "429", description = "Demasiadas tentativas",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/login/mfa")
    public ResponseEntity<AuthResponse> adminMfa(@Valid @RequestBody AdminMfaRequest request,
                                                 HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.verifyAdminMfa(request), http, response);
    }

    @Operation(
            summary = "Mudar password",
            description = """
                    Com sessão iniciada: pede a password atual. A nova segue a política (8–72 caracteres, não pode ser
                    comum nem conter o telefone ou o nome). Termina todas as outras sessões e devolve tokens novos.
                    """
    )
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Password mudada — tokens novos",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Password atual errada ou nova fora da política",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "429", description = "Demasiadas tentativas",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/password/change")
    public ResponseEntity<AuthResponse> changePassword(@AuthenticationPrincipal UUID profileId,
                                                       @Valid @RequestBody ChangePasswordRequest request,
                                                       HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.changePassword(profileId, request), http, response);
    }

    @Operation(
            summary = "Registo via Google - passo 1",
            description = """
                    Completa o registo iniciado pelo callback do Google (que devolveu um
                    `pendingToken` porque não existia perfil correspondente). Submete o
                    número de telefone e o tipo de conta, e envia um OTP por SMS para
                    confirmar o número.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "OTP enviado"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos, token expirado ou número já registado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/google/register")
    public ResponseEntity<Void> registerGoogle(@Valid @RequestBody GoogleRegisterRequest request) {
        authService.registerGoogle(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Registo via Google - passo 2",
            description = """
                    Confirma o número de telefone com o OTP recebido por SMS e cria o
                    perfil já associado à conta Google. Devolve os tokens de sessão.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Perfil criado - tokens emitidos",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código inválido, expirado ou token de registo inválido",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/google/verify")
    public ResponseEntity<AuthResponse> verifyGoogleRegistration(@Valid @RequestBody GoogleVerifyRequest request,
                                                                 HttpServletRequest http, HttpServletResponse response) {
        return tokens(authService.verifyGoogleRegistration(request), http, response);
    }

    // Cliente web: o refresh vai num cookie httpOnly e sai do corpo da resposta
    private ResponseEntity<AuthResponse> tokens(AuthResponse auth, HttpServletRequest http, HttpServletResponse response) {
        if (auth.refreshToken() == null || !"web".equalsIgnoreCase(http.getHeader(CLIENT_HEADER))) {
            return ResponseEntity.ok(auth);
        }
        Duration ttl = Duration.ofDays(jwtProperties.refreshExpirationDays());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(auth.refreshToken(), ttl).toString());
        return ResponseEntity.ok(auth.withoutRefreshToken());
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(securityProperties.cookieSecure())
                // Strict: o browser nunca o envia num pedido vindo de outro site (sem CSRF no /refresh)
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }

    private static String readRefreshCookie(HttpServletRequest http) {
        if (http.getCookies() == null) return null;
        return Arrays.stream(http.getCookies())
                .filter(c -> REFRESH_COOKIE.equals(c.getName()))
                .map(jakarta.servlet.http.Cookie::getValue)
                .filter(v -> v != null && !v.isBlank())
                .findFirst()
                .orElse(null);
    }

    record ErrorResponse(String message, int status) {}
}
