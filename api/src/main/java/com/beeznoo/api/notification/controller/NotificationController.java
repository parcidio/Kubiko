package com.beeznoo.api.notification.controller;

import com.beeznoo.api.notification.dto.NotificationDtos.*;
import com.beeznoo.api.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Notificações", description = "Histórico de notificações na app (sem tempo real: o frontend consulta periodicamente)")
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(
            summary = "As minhas notificações",
            description = """
                    Últimas 50 notificações do perfil autenticado, da mais recente para a mais antiga.
                    `linkPath` é o caminho no frontend para onde a notificação leva (ex.: `/reservas/{id}`).

                    Não há WebSocket no MVP: consultar `/notifications/me/unread-count` a cada ~60 s.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Histórico devolvido",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = NotificationResponse.class)))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me")
    public ResponseEntity<List<NotificationResponse>> listMine(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(notificationService.listMine(profileId));
    }

    @Operation(
            summary = "Contagem de não lidas",
            description = "Pedido leve para o polling do frontend (badge do sino)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contagem devolvida",
                    content = @Content(schema = @Schema(implementation = UnreadCountResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me/unread-count")
    public ResponseEntity<UnreadCountResponse> unreadCount(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(new UnreadCountResponse(notificationService.countUnread(profileId)));
    }

    @Operation(summary = "Marcar como lida", description = "Idempotente: marcar outra vez não muda `readAt`.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Notificação marcada como lida",
                    content = @Content(schema = @Schema(implementation = NotificationResponse.class))),
            @ApiResponse(responseCode = "400", description = "Notificação não encontrada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "403", description = "A notificação é de outra pessoa",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markRead(
            @AuthenticationPrincipal UUID profileId,
            @PathVariable UUID id) {
        return ResponseEntity.ok(notificationService.markRead(profileId, id));
    }

    @Operation(summary = "Marcar todas como lidas")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Número de notificações marcadas",
                    content = @Content(schema = @Schema(implementation = MarkAllReadResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @PostMapping("/me/read-all")
    public ResponseEntity<MarkAllReadResponse> markAllRead(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(new MarkAllReadResponse(notificationService.markAllRead(profileId)));
    }

    record ErrorResponse(String error) {}
}
