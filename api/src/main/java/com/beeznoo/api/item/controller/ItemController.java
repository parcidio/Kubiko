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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

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
            @Valid @RequestBody PublishItemRequest request) {
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

    @Operation(
            summary = "Listar itens ativos",
            description = """
                    Devolve os itens com estado `ACTIVE`, paginados.
                    Filtra opcionalmente por categoria através do parâmetro `categoryId`.

                    Endpoint público, não requer autenticação.
                    """
    )
    @ApiResponse(responseCode = "200", description = "Lista de itens devolvida com sucesso",
            content = @Content(schema = @Schema(implementation = ItemSummaryResponse.class)))
    @GetMapping
    public ResponseEntity<Page<ItemSummaryResponse>> listActive(
            @RequestParam(required = false) UUID categoryId,
            Pageable pageable) {
        return ResponseEntity.ok(itemService.listActive(categoryId, pageable));
    }

    @Operation(
            summary = "Listar os meus itens",
            description = """
                    Devolve os itens do perfil autenticado, paginados, excluindo
                    os itens com estado `DELETED`.
                    """
    )
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "200", description = "Lista de itens devolvida com sucesso",
            content = @Content(schema = @Schema(implementation = ItemSummaryResponse.class)))
    @GetMapping("/me")
    public ResponseEntity<Page<ItemSummaryResponse>> listMyItems(
            @AuthenticationPrincipal UUID profileId,
            Pageable pageable) {
        return ResponseEntity.ok(itemService.listMyItems(profileId, pageable));
    }

    @Operation(
            summary = "Atualizar item",
            description = """
                    Atualiza apenas os campos fornecidos no corpo do pedido —
                    campos omitidos (`null`) mantêm o valor atual.
                    Apenas o dono do item pode atualizar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Item atualizado com sucesso",
            content = @Content(schema = @Schema(implementation = ItemResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou categoria não encontrada",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "403", description = "Perfil não é o dono do item",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item não encontrado")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/{id}")
    public ResponseEntity<ItemResponse> update(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateItemRequest request) {
        return ResponseEntity.ok(itemService.update(profileId, id, request));
    }

    @Operation(
            summary = "Desativar item",
            description = "Muda o estado do item para `INACTIVE`. Apenas o dono pode desativar."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Item desativado com sucesso"),
            @ApiResponse(responseCode = "403", description = "Perfil não é o dono do item",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item não encontrado")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivate(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        itemService.deactivate(profileId, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Eliminar item (soft delete)",
            description = """
                    Muda o estado do item para `DELETED` — o registo não é removido
                    da base de dados. Apenas o dono pode eliminar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Item eliminado com sucesso"),
            @ApiResponse(responseCode = "403", description = "Perfil não é o dono do item",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item não encontrado")
    })
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        itemService.delete(profileId, id);
        return ResponseEntity.noContent().build();
    }
}
