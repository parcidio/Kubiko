package com.beeznoo.api.item.controller;

import com.beeznoo.api.item.dto.ItemDtos.*;
import com.beeznoo.api.item.repository.CategoryRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
@Tag(name = "Categories", description = "Categorias de equipamento disponíveis na plataforma")
public class CategoryController {

    private final CategoryRepository categoryRepository;

    @Operation(
            summary = "Listar categorias",
            description = """
                    Devolve todas as categorias disponíveis na plataforma.
                    Inclui categorias pai e subcategorias - o campo `parentId`
                    identifica a hierarquia (null = categoria raiz).
                    
                    Endpiont públic, não requer autenticação.
                    """
    )
    @ApiResponse(responseCode = "200",
            description = "Lista de categorias devolvida com sucesso",
            content = @Content(schema = @Schema(implementation = CategoryResponse.class))
    )
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list() {
        List<CategoryResponse> result = categoryRepository.findAll().stream()
                .map(c -> new CategoryResponse(
                        c.getId(), c.getName(), c.getSlug(), c.getIconUrl(),
                        c.getParent() != null ? c.getParent().getId() :  null))
                .toList();
        return ResponseEntity.ok(result);
    }
}
