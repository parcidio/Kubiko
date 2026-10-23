package com.beeznoo.api.item.controller;

import com.beeznoo.api.item.dto.ItemDtos.PhotoResponse;
import com.beeznoo.api.item.service.ItemPhotoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/items/{itemId}/photos")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Items", description = "Publicação e gestão de equipamentos para arrendamento")
public class ItemPhotoController {

    private final ItemPhotoService itemPhotoService;

    @Operation(
            summary = "Enviar fotos do equipamento",
            description = """
                    `multipart/form-data` com uma ou mais partes `photos`. JPEG ou PNG (validado pelo conteúdo),
                    até 5 MB cada, máximo 8 por equipamento. Comprime no telemóvel antes de enviar.

                    As fotos ficam no fim da lista; a primeira é a capa. Devolve todas as fotos com URL assinada
                    válida 12 h (`photUrl`). Só o dono do equipamento.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Fotos guardadas",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = PhotoResponse.class)))),
            @ApiResponse(responseCode = "400", description = "Sem fotos, tipo inválido, mais de 5 MB, limite de 8 ou item não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o dono do equipamento",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "413", description = "Pedido demasiado grande",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<PhotoResponse>> upload(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID itemId,
            @RequestPart("photos") List<MultipartFile> photos) {
        return ResponseEntity.status(HttpStatus.CREATED).body(itemPhotoService.upload(profileId, itemId, photos));
    }

    @Operation(summary = "Apagar foto", description = "Devolve as fotos que ficam. Só o dono do equipamento.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Foto apagada",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = PhotoResponse.class)))),
            @ApiResponse(responseCode = "400", description = "Item ou foto não encontrados",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o dono do equipamento",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/{photoId}")
    public ResponseEntity<List<PhotoResponse>> delete(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID itemId,
            @PathVariable UUID photoId) {
        return ResponseEntity.ok(itemPhotoService.delete(profileId, itemId, photoId));
    }

    record ErrorResponse(String error) {}
}
