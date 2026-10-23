package com.beeznoo.api.profile.controller;

import com.beeznoo.api.profile.dto.MeDtos.MeResponse;
import com.beeznoo.api.profile.dto.MeDtos.UpdateMeRequest;
import com.beeznoo.api.profile.service.EmailVerificationService;
import com.beeznoo.api.profile.service.ProfileService;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/profiles")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Perfil", description = "O perfil da pessoa autenticada")
public class ProfileController {

    private final ProfileService profileService;
    private final EmailVerificationService emailVerificationService;

    @Operation(
            summary = "O meu perfil",
            description = """
                    Nome, contactos, papel, tipo de conta e estado de verificação.
                    - `phoneVerified` -- telefone confirmado por OTP
                    - `identityVerified` -- KYC aprovado (selo "Verificado"; obrigatório para reservar e publicar)
                    - `kycStatus` -- estado da verificação mais recente, ou `null` se nunca submeteu
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Perfil devolvido",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "400", description = "Perfil não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(profileService.getMe(profileId));
    }

    @Operation(
            summary = "Editar o meu perfil",
            description = """
                    Campos opcionais: `fullName`, `email`, `province`, `city`. O que vier a `null` fica igual;
                    `email: ""` remove o email (deixa de receber notificações por email).
                    O telefone não se muda aqui.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Perfil atualizado",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "409", description = "Email já usado noutra conta",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/me")
    public ResponseEntity<MeResponse> updateMe(
            @AuthenticationPrincipal UUID profileId,
            @Valid @RequestBody UpdateMeRequest request) {
        return ResponseEntity.ok(profileService.updateMe(profileId, request));
    }

    @Operation(
            summary = "Pedir código para verificar o email",
            description = "Envia um código de 6 dígitos (válido 15 min) para o email do perfil. 1 por minuto, 5 por hora."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Código enviado"),
            @ApiResponse(responseCode = "400", description = "Perfil sem email",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "409", description = "Já verificado, ou envio de email desligado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "429", description = "Demasiados pedidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/me/email/verification")
    public ResponseEntity<Void> requestEmailVerification(@AuthenticationPrincipal UUID profileId) {
        emailVerificationService.request(profileId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Confirmar o email com o código", description = "5 tentativas por código.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Email verificado",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "400", description = "Código errado, expirado ou bloqueado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @PostMapping("/me/email/verification/confirm")
    public ResponseEntity<MeResponse> confirmEmail(@AuthenticationPrincipal UUID profileId,
                                                   @Valid @RequestBody ConfirmEmailRequest request) {
        emailVerificationService.confirm(profileId, request.code());
        return ResponseEntity.ok(profileService.getMe(profileId));
    }

    public record ConfirmEmailRequest(
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{6}$", message = "O código tem 6 dígitos") String code) {}

    record ErrorResponse(String error) {}
}
