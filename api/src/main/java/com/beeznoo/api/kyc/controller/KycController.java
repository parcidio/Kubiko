package com.beeznoo.api.kyc.controller;

import com.beeznoo.api.kyc.dto.KycDtos.KycStatusResponse;
import com.beeznoo.api.kyc.entity.DocumentType;
import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.profile.entity.AccountType;
import io.swagger.v3.oas.annotations.Operation;
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

import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kyc")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "KYC", description = "Verificação de identidade — obrigatória para pedir reservas e publicar equipamento")
public class KycController {

    private final KycService kycService;

    @Operation(
            summary = "Submeter documentos",
            description = """
                    Envia os documentos de identidade (`multipart/form-data`). A verificação fica `PENDING`
                    até a equipa Beeznoo decidir.

                    Campos:
                    - `accountType` -- `INDIVIDUAL` ou `BUSINESS`
                    - `INDIVIDUAL`: `biFront`, `biBack`, `selfie`
                    - `BUSINESS`: `nifDocument`, `businessDocument`

                    Cada ficheiro: JPEG, PNG ou PDF (validado pelo conteúdo), até 5 MB.

                    Pode submeter-se outra vez depois de `REJECTED` (nova verificação) ou de
                    `INFO_REQUESTED` (os novos documentos entram na mesma verificação, que volta a `PENDING`).
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Documentos recebidos -- verificação PENDING",
                    content = @Content(schema = @Schema(implementation = KycStatusResponse.class))),
            @ApiResponse(responseCode = "400", description = "Falta um documento, tipo de ficheiro inválido ou documento que não se aplica ao tipo de conta",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado"),
            @ApiResponse(responseCode = "409", description = "Já existe uma verificação em análise ou aprovada",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "413", description = "Ficheiro maior do que o permitido",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping(value = "/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<KycStatusResponse> submit(
            @AuthenticationPrincipal UUID profileId,
            @RequestParam AccountType accountType,
            @RequestPart(required = false) MultipartFile biFront,
            @RequestPart(required = false) MultipartFile biBack,
            @RequestPart(required = false) MultipartFile selfie,
            @RequestPart(required = false) MultipartFile nifDocument,
            @RequestPart(required = false) MultipartFile businessDocument) {
        Map<DocumentType, MultipartFile> files = new EnumMap<>(DocumentType.class);
        if (biFront != null) files.put(DocumentType.BI_FRONT, biFront);
        if (biBack != null) files.put(DocumentType.BI_BACK, biBack);
        if (selfie != null) files.put(DocumentType.SELFIE, selfie);
        if (nifDocument != null) files.put(DocumentType.NIF_DOCUMENT, nifDocument);
        if (businessDocument != null) files.put(DocumentType.BUSINESS_DOCUMENT, businessDocument);
        return ResponseEntity.status(HttpStatus.CREATED).body(kycService.submit(profileId, accountType, files));
    }

    @Operation(
            summary = "Estado da minha verificação",
            description = """
                    Devolve a verificação mais recente: `status`, datas e, se for o caso, o motivo da recusa
                    (`rejectionReason`) ou o que falta (`infoRequestNote`).

                    Se ainda não submeteu nada, todos os campos vêm a `null`.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Estado devolvido",
                    content = @Content(schema = @Schema(implementation = KycStatusResponse.class))),
            @ApiResponse(responseCode = "401", description = "Não autenticado")
    })
    @GetMapping("/me")
    public ResponseEntity<KycStatusResponse> me(@AuthenticationPrincipal UUID profileId) {
        return ResponseEntity.ok(kycService.getMyStatus(profileId));
    }

    record ErrorResponse(String error) {}
}
