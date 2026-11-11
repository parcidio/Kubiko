package com.beeznoo.api.common.pdf;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Emitente dos documentos em PDF (comprovativo de pagamento, contrato). Campos vazios ficam de fora do documento.
 * Ver claude/decisoes-produto.md (2026-11-11).
 */
@ConfigurationProperties(prefix = "app.company")
public record CompanyProperties(String legalName, String nif, String address, String email) {
    public CompanyProperties {
        if (legalName == null || legalName.isBlank()) legalName = "Beeznoo";
    }
}
