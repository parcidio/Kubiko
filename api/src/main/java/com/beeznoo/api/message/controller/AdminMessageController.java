package com.beeznoo.api.message.controller;

import com.beeznoo.api.message.dto.MessageDtos.*;
import com.beeznoo.api.message.service.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Admin › Mensagens — contrato em docs/API_ADMIN_MESSAGES_GEO.md, decisão em decisoes-produto.md 2026-11-17. */
@RestController
@RequestMapping("/api/v1/admin/messages")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Admin · Mensagens", description = "Modelos e envio de mensagens da equipa (WhatsApp, email, SMS)")
public class AdminMessageController {

    // mesmo formato do registo: +244 e 9 dígitos, ou internacional E.164
    private static final String PHONE = "^(\\+244[0-9]{9}|\\+(?!244)[1-9][0-9]{7,14})$";

    private final MessageService messageService;

    @Operation(summary = "Modelos", description = "Predefinidos primeiro. `channel` null = qualquer canal. Apenas ADMIN.")
    @GetMapping("/templates")
    public ResponseEntity<List<TemplateResponse>> templates() {
        return ResponseEntity.ok(messageService.templates());
    }

    @Operation(summary = "Criar modelo", description = "`{ name ≤ 80, subject?, body ≤ 1000, channel? }`. Variáveis: `{{nome}}`, `{{primeiro_nome}}`.")
    @PostMapping("/templates")
    public ResponseEntity<TemplateResponse> createTemplate(@AuthenticationPrincipal UUID adminId,
                                                           @Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(messageService.createTemplate(adminId, request));
    }

    @Operation(summary = "Editar modelo")
    @PutMapping("/templates/{id}")
    public ResponseEntity<TemplateResponse> updateTemplate(@PathVariable UUID id, @Valid @RequestBody TemplateRequest request) {
        return ResponseEntity.ok(messageService.updateTemplate(id, request));
    }

    @Operation(summary = "Apagar modelo", description = "Predefinidos: 409 `predefined_template`.")
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID id) {
        messageService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "O número tem WhatsApp?", description = """
            Pergunta ao Losambo. `hasWhatsApp` null = gateway indisponível. `international` = fora de +244
            (esses números só recebem por WhatsApp).
            """)
    @GetMapping("/whatsapp-check")
    public ResponseEntity<WhatsAppCheckResponse> whatsAppCheck(@RequestParam String phone) {
        String p = phone == null ? "" : phone.strip();
        if (!p.matches(PHONE)) throw new IllegalArgumentException("Número em formato internacional: +244XXXXXXXXX ou +<indicativo><número>");
        return ResponseEntity.ok(messageService.whatsAppCheck(p));
    }

    @Operation(summary = "Pré-visualizar envio", description = """
            Quantas pessoas recebem, quantas ficam de fora e porquê, e o texto para a primeira. Não envia nada.
            """)
    @PostMapping("/preview")
    public ResponseEntity<PreviewResponse> preview(@Valid @RequestBody SendRequest request) {
        return ResponseEntity.ok(messageService.preview(request));
    }

    @Operation(summary = "Enviar", description = """
            202: a mensagem fica registada e sai em segundo plano (WhatsApp com pausa de 2–4 s entre mensagens).
            422 `too_many_recipients` (2000; WhatsApp 300), 422 `no_recipients`, 503 `channel_unavailable`,
            429 `whatsapp_hourly_cap` (mensagens de WhatsApp por admin por hora, omissão 500).
            Auditoria `MESSAGE_SENT`.
            """)
    @PostMapping
    public ResponseEntity<SendResponse> send(@AuthenticationPrincipal UUID adminId, @Valid @RequestBody SendRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(messageService.send(adminId, request));
    }

    @Operation(summary = "Histórico de envios", description = "Mais recentes primeiro, 20 por página.")
    @GetMapping
    public ResponseEntity<Page<MessageSummary>> list(@RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(messageService.list(Math.max(page, 0), Math.clamp(size, 1, 100)));
    }

    @Operation(summary = "Detalhe de um envio", description = "Com as entregas (destino mascarado, estado e motivo).")
    @GetMapping("/{id}")
    public ResponseEntity<MessageDetail> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(messageService.detail(id));
    }
}
