package com.beeznoo.api.item.controller;

import com.beeznoo.api.item.dto.ItemDtos.*;
import com.beeznoo.api.item.service.ItemService;
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
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.nio.file.AccessDeniedException;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/items")
@RequiredArgsConstructor
@Tag(name = "Items", description = "Publicação e gestão de equipamentos para arrendamento")
public class ItemController {

    private final ItemService itemService;

    @Operation(
            summary = "Publicar item",
            description = """
                    Cria um novo item de equipamento para arrendamento.
                    Apenas perfis com papel `OWNER` ou `BOTH` podem publicar.
                    
                    O item fica com estado `ACTIVE` imediatamente após publicação -
                    não há moderação prévia nesta fase.
                    
                    As fotos são geridas separadamente após a criação do item
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Item publicado com sucesso",
            content = @Content(schema = @Schema(implementation = ItemResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou categoria não encontrada",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "403", description = "Perfil sem permissão para publicar (role RENTER)",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<ItemResponse> publish(
            @AuthenticationPrincipal UUID profileId,
            @Valid @RequestBody PublishItemRequest request) throws AccessDeniedException {
        return ResponseEntity.status(201).body(itemService.publish(profileId, request));
    }

    @Operation(
            summary = "Detalhe de um item",
            description = """
                    Devolve o detalhe completo de um item, incluindo categoria,
                    fotos ordenadas por posição e contagem de visualizações.
                    
                    Itens com estado `DELETED` não são devolvidas (404).
                    Endpoint público, não requer autenticação.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Item encontrado",
            content = @Content(schema = @Schema(implementation = ItemResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item não encontrado",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    public ResponseEntity<ItemResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(itemService.getById(id));
    }
}
