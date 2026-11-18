package com.beeznoo.api.profile.controller;

import com.beeznoo.api.profile.dto.MeDtos.MeResponse;
import com.beeznoo.api.profile.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me/avatar")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Perfil", description = "O perfil da pessoa autenticada")
public class AvatarController {

    private final ProfileService profileService;

    @Operation(
            summary = "Mudar a minha foto de perfil",
            description = """
                    Multipart com a parte `photo`: JPEG ou PNG, até 5 MB (o tipo vê-se pelos bytes). A imagem é
                    recodificada (sai o EXIF) e guardada em storage privado; substitui a anterior.
                    Devolve o perfil com `avatarUrl` assinada de curta duração (1 h). Limite: 10 por hora.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Foto guardada",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "400", description = "Ficheiro vazio, grande demais ou de tipo errado"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "429", description = "Demasiados pedidos")
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MeResponse> upload(@AuthenticationPrincipal UUID profileId,
                                             @RequestPart("photo") MultipartFile photo) {
        return ResponseEntity.ok(profileService.uploadAvatar(profileId, photo));
    }

    @Operation(summary = "Remover a minha foto de perfil",
            description = "Apaga a foto enviada (e esquece a do Google). Passam a aparecer as iniciais.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Foto removida",
                    content = @Content(schema = @Schema(implementation = MeResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @DeleteMapping
    public ResponseEntity<MeResponse> delete(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(profileService.deleteAvatar(profileId));
    }
}
