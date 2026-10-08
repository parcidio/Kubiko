package com.beeznoo.api.booking.controller;

import com.beeznoo.api.booking.dto.BookingDtos.*;
import com.beeznoo.api.booking.service.BookingService;
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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Bookings", description = "Pedidos de reserva e ciclo de vida do arrendamento")
public class BookingController {

    private final BookingService bookingService;

    @Operation(
            summary = "Criar reserva",
            description = """
                    O arrendatário pede para reservar um item por um período de datas.
                    Apenas perfis com papel `RENTER` ou `BOTH` podem criar reservas.

                    Regras:
                    - o item tem de estar `ACTIVE`
                    - `endDate` tem de ser posterior a `startDate` (`endDate` é o dia de devolução)
                    - não pode existir reserva `ACCEPTED` ou `ACTIVE` sobreposta para o mesmo item
                    - não é possível reservar o próprio item

                    `totalPrice` = `pricePerDay` × número de dias. A caução é copiada do item.
                    A reserva fica com estado `PENDING_OWNER` até o dono responder.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Reserva criada com estado PENDING_OWNER",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos, datas inválidas ou item não encontrado",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil sem permissão para reservar (role OWNER)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Item indisponível ou datas sobrepostas com outra reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping
    public ResponseEntity<BookingResponse> create(
            @AuthenticationPrincipal UUID profileId,
            @Valid @RequestBody CreateBookingRequest request) {
        return ResponseEntity.status(201).body(bookingService.create(profileId, request));
    }

    @Operation(
            summary = "As minhas reservas (arrendatário)",
            description = """
                    Devolve, paginadas, as reservas feitas pelo perfil autenticado
                    enquanto arrendatário, em qualquer estado.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista de reservas devolvida com sucesso",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me/renter")
    public ResponseEntity<Page<BookingResponse>> listAsRenter(
            @AuthenticationPrincipal UUID profileId,
            Pageable pageable) {
        return ResponseEntity.ok(bookingService.listAsRenter(profileId, pageable));
    }

    @Operation(
            summary = "Reservas dos meus itens (dono)",
            description = """
                    Devolve, paginadas, as reservas feitas sobre os itens do perfil
                    autenticado, em qualquer estado. Usado pelo dono para ver os
                    pedidos pendentes e o histórico.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lista de reservas devolvida com sucesso",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me/owner")
    public ResponseEntity<Page<BookingResponse>> listAsOwner(
            @AuthenticationPrincipal UUID profileId,
            Pageable pageable) {
        return ResponseEntity.ok(bookingService.listAsOwner(profileId, pageable));
    }

    @Operation(
            summary = "Detalhe de uma reserva",
            description = """
                    Devolve o detalhe da reserva, com resumo do item e nomes das partes.
                    Apenas o arrendatário ou o dono envolvidos podem consultar.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reserva encontrada",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getById(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.getById(profileId, id));
    }

    @Operation(
            summary = "Aceitar reserva (dono)",
            description = """
                    O dono do item aceita o pedido. Transição `PENDING_OWNER` → `ACCEPTED`.
                    A reserva fica a aguardar pagamento.

                    `ownerNote` é opcional. Falha com 409 se entretanto outra reserva
                    tiver sido aceite para datas sobrepostas.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reserva aceite",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é o dono do item",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Estado atual não permite aceitar ou datas já ocupadas",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/accept")
    public ResponseEntity<BookingResponse> accept(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) BookingActionRequest request) {
        return ResponseEntity.ok(bookingService.accept(profileId, id, request));
    }

    @Operation(
            summary = "Cancelar ou recusar reserva",
            description = """
                    O comportamento depende de quem faz o pedido:

                    - **Dono** — recusa ou cancela. `PENDING_OWNER` ou `ACCEPTED` → `CANCELLED_OWNER`.
                      `ownerNote` é opcional.
                    - **Arrendatário** — cancela o pedido. Apenas `PENDING_OWNER` → `CANCELLED_RENTER`.
                      `ownerNote` é ignorado.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reserva cancelada",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "400", description = "Dados inválidos",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Estado atual não permite cancelar",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<BookingResponse> cancel(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) BookingActionRequest request) {
        return ResponseEntity.ok(bookingService.cancel(profileId, id, request));
    }

    @Operation(
            summary = "Confirmar pagamento (admin)",
            description = """
                    Endpoint interno, restrito a perfis `ADMIN`, enquanto não existe
                    integração com Multicaixa. Transição `ACCEPTED` → `ACTIVE`.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Pagamento confirmado, reserva ativa",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é ADMIN",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não está ACCEPTED",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/confirm-payment")
    public ResponseEntity<BookingResponse> confirmPayment(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.confirmPayment(profileId, id));
    }

    @Operation(
            summary = "Completar reserva (admin)",
            description = """
                    Endpoint interno, restrito a perfis `ADMIN`. Marca o equipamento
                    como devolvido com sucesso. Transição `ACTIVE` → `COMPLETED`.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Reserva concluída",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é ADMIN",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não está ACTIVE",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/complete")
    public ResponseEntity<BookingResponse> complete(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.complete(profileId, id));
    }

    @Operation(
            summary = "Abrir disputa",
            description = """
                    O arrendatário ou o dono abrem uma reclamação sobre a reserva
                    em curso. Transição `ACTIVE` → `DISPUTED`.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Disputa aberta",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "Perfil não é parte da reserva",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Reserva não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Reserva não está ACTIVE",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/dispute")
    public ResponseEntity<BookingResponse> dispute(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.dispute(profileId, id));
    }

    record ErrorResponse(String message, int status) {}
}
