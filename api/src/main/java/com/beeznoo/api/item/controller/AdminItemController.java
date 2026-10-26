package com.beeznoo.api.item.controller;

import com.beeznoo.api.item.dto.ItemDtos.FeatureItemRequest;
import com.beeznoo.api.item.dto.ItemDtos.ItemResponse;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/items")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Equipamento", description = "Destaques no Explorar")
public class AdminItemController {

    private final ItemService itemService;

    @Operation(summary = "Pôr ou tirar destaque",
            description = "`featured=true` mostra o equipamento na faixa \"Em destaque\" do Explorar. Fica na auditoria. Apenas ADMIN.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Destaque atualizado",
                    content = @Content(schema = @Schema(implementation = ItemResponse.class))),
            @ApiResponse(responseCode = "400", description = "Item não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Apenas administradores",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Equipamento não está ativo",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/featured")
    public ResponseEntity<ItemResponse> setFeatured(@AuthenticationPrincipal UUID adminId, @PathVariable UUID id,
                                                    @Valid @RequestBody FeatureItemRequest request) {
        return ResponseEntity.ok(itemService.setFeatured(adminId, id, request.featured()));
    }

    record ErrorResponse(String error) {}
}
