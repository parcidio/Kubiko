package com.beeznoo.api.profile.controller;

import com.beeznoo.api.profile.dto.MeDtos.MeResponse;
import com.beeznoo.api.profile.dto.MeDtos.UpdateMeRequest;
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

    record ErrorResponse(String error) {}
}
