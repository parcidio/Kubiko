package com.beeznoo.api.contract.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.common.pdf.CompanyProperties;
import com.beeznoo.api.contract.entity.Contract;
import com.beeznoo.api.transaction.config.PaymentProperties;
import com.beeznoo.api.transaction.service.ReceiptPdfTestData;
import com.beeznoo.api.transaction.service.ServiceFees;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ContractPdfTest {

    @Test
    void contratoTemTextoAceitacaoEHash() throws Exception {
        Booking booking = ReceiptPdfTestData.booking();
        ContractService contracts = new ContractService(null, null, null,
                new ServiceFees(new PaymentProperties(null, null, null, null)), null);
        String body = contracts.render(booking);
        Contract contract = Contract.builder().id(UUID.randomUUID()).booking(booking)
                .version(ContractService.CURRENT_VERSION).body(body).bodySha256("a".repeat(64))
                .ownerAcceptedAt(OffsetDateTime.of(2026, 10, 14, 9, 5, 0, 0, ZoneOffset.UTC))
                .renterAcceptedAt(OffsetDateTime.of(2026, 10, 15, 10, 0, 0, 0, ZoneOffset.UTC))
                .createdAt(OffsetDateTime.of(2026, 10, 14, 9, 5, 0, 0, ZoneOffset.UTC))
                .build();

        byte[] pdf = new ContractPdfService(null, null, null,
                new CompanyProperties("Beeznoo, Lda.", null, null, null), null).render(contract);

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(doc);
            assertThat(text)
                    .contains("CONTRATO DE ALUGUER DE EQUIPAMENTO")
                    .contains("1. Partes")
                    .contains("Estúdio Kianda, Lda.")
                    .contains("Como novo")          // estado em português, não LIKE_NEW
                    .contains("437.480 Kz")
                    .contains("aceite em 15 out 2026, 11:00")
                    .contains("SHA-256: " + "a".repeat(64))
                    .contains("Página 1 de " + doc.getNumberOfPages());
            ReceiptPdfTestData.dump(doc, pdf, "contrato");
        }
    }
}
