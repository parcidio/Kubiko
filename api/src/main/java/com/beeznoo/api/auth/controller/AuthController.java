package com.beeznoo.api.auth.controller;

import com.beeznoo.api.auth.dto.AuthDtos.*;
import com.beeznoo.api.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Registo, login e recuperação de password")
public class AuthController {

    private final AuthService authService;

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
    public ResponseEntity<AuthResponse> verifyOtp(@Valid @RequestBody VerifyRegistrationRequest request) {
        return ResponseEntity.ok(authService.verifyRegistration(request));
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
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
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
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request.refreshToken()));
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
    public ResponseEntity<Void> logout(Principal principal) {
        authService.logout(UUID.fromString(principal.getName()));
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Associar conta Google",
            description = "Inicia o OAuth2 flow. Requer Bearer token. " +
                    "Após callback, redireciona para /oatuh/callback."
    )
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "302", description = "Redireccinado para o Google")
    @GetMapping("/google/link")
    public ResponseEntity<Void> linkGoogle() {
        return ResponseEntity.status(302).build();
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
    public ResponseEntity<AuthResponse> verifyGoogleRegistration(@Valid @RequestBody GoogleVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyGoogleRegistration(request));
    }

    record ErrorResponse(String message, int status) {}
}
