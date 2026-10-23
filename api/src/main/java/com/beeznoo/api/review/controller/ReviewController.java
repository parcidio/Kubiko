package com.beeznoo.api.review.controller;

import com.beeznoo.api.review.dto.ReviewDtos.CreateReviewRequest;
import com.beeznoo.api.review.dto.ReviewDtos.ReviewResponse;
import com.beeznoo.api.review.service.ReviewService;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Avaliações", description = "Avaliação do arrendatário depois de uma reserva concluída")
public class ReviewController {

    private final ReviewService reviewService;

    @Operation(summary = "Avaliar reserva",
            description = "Nota 1–5 e comentário opcional (≤ 1000). Só o arrendatário, só com a reserva `COMPLETED`, uma vez.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Avaliação criada",
                    content = @Content(schema = @Schema(implementation = ReviewResponse.class))),
            @ApiResponse(responseCode = "400", description = "Nota fora de 1–5 ou reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Não é o arrendatário desta reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não concluída ou já avaliada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/bookings/{bookingId}/review")
    public ResponseEntity<ReviewResponse> create(@AuthenticationPrincipal UUID profileId, @PathVariable UUID bookingId,
                                                 @Valid @RequestBody CreateReviewRequest request) {
        return ResponseEntity.status(201).body(reviewService.create(profileId, bookingId, request));
    }

    @Operation(summary = "Avaliação de uma reserva", description = "Arrendatário ou dono. `204` se ainda não foi avaliada.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Avaliação devolvida",
                    content = @Content(schema = @Schema(implementation = ReviewResponse.class))),
            @ApiResponse(responseCode = "204", description = "Ainda sem avaliação"),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Sem acesso a esta reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/bookings/{bookingId}/review")
    public ResponseEntity<ReviewResponse> forBooking(@AuthenticationPrincipal UUID profileId, @PathVariable UUID bookingId) {
        ReviewResponse review = reviewService.forBooking(profileId, bookingId);
        return review == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(review);
    }

    @Operation(summary = "Avaliações de um equipamento", description = "Mais recentes primeiro. Público. Páginas ≤ 50.")
    @ApiResponse(responseCode = "200", description = "Lista devolvida",
            content = @Content(schema = @Schema(implementation = ReviewResponse.class)))
    @GetMapping("/items/{itemId}/reviews")
    public ResponseEntity<Page<ReviewResponse>> forItem(@PathVariable UUID itemId,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "10") int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 50));
        return ResponseEntity.ok(reviewService.forItem(itemId, pageable));
    }

    record ErrorResponse(String error) {}
}
