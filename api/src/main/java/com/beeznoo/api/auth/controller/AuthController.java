package com.beeznoo.api.auth.controller;

import com.beeznoo.api.auth.dto.AuthResponse;
import com.beeznoo.api.auth.dto.RefreshRequest;
import com.beeznoo.api.auth.dto.SendOtpRequest;
import com.beeznoo.api.auth.dto.VerifyOptRequest;
import com.beeznoo.api.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
@Tag(name = "Auth", description = "Autenticação por OTP via WhatsApp + Google OAuth")
public class AuthController {

    private final AuthService authService;

    @Operation(
            summary = "Enviar OTP",
            description = "Envia um código OTP de 6 dígitos para o número de WhatsApp indicado. " +
                    "O código expira em 10 minutos. Qualquer código anterior para o mesmo número é inválido."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "OTP enviado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Número de telefone inválido",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "503", description = "Falha ao contactar a WhatsApp API",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/otp/send")
    public ResponseEntity<Void> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        authService.sendOtp(request.phone());
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Verificar OTP e autenticar",
            description = "Verifica o código OTP. Se o perfil não existir, é criado autenticamente " +
                    "(registe implícito). Devolve access token (JWT , 15 min) e refresh token (30 dias)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autenticado com sucesso",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código inválido, expirado ou número incorreto",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/otp/verify")
    public ResponseEntity<AuthResponse> verifyOtp(@Valid @RequestBody VerifyOptRequest request) {
        return ResponseEntity.ok(authService.verifyOtp(request));
    }

    @Operation(
            summary = "Renovar access token",
            description = "Usa o refresh token para emitir um novo access token. " +
                    "O refresh token é rotationado (o antigo é revogado um novo é emitido)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Token renovado com sucesso",
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "401", description = "Refresh token inválido ou expirado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request.refreshToken()));
    }

    @Operation(
            summary = "Logout",
            description = "Revoga todos os refresh tokens do utilizador autenticado. " +
                    "O access token continua válido até expirar (15 min), comportamento normal em JWT stateless"
    )
    @ApiResponse(responseCode = "204", description = "Logout bem-sucedido")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Principal principal) {
        authService.logout(UUID.fromString(principal.getName()));
        return ResponseEntity.noContent().build();
    }

    record ErrorResponse(String message, int status) {}
}
