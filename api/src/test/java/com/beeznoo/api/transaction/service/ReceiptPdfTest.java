package com.beeznoo.api.transaction.service;

import com.beeznoo.api.common.pdf.CompanyProperties;
import com.beeznoo.api.transaction.entity.Payment;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/** Gera o comprovativo sem BD e lê o texto de volta. Com -Dpdf.out=<pasta> também grava o PDF e um PNG. */
class ReceiptPdfTest {

    static Payment samplePayment() {
        return ReceiptPdfTestData.payment();
    }

    @Test
    void comprovativoTemOsDadosDeUmRecibo() throws Exception {
        ReceiptService service = new ReceiptService(null, null,
                new CompanyProperties("Beeznoo, Lda.", "5000000000", "Talatona, Luanda, Angola", "ajuda@beeznoo.ao"), null);
        byte[] pdf = service.render(samplePayment(), OffsetDateTime.of(2026, 10, 15, 14, 0, 0, 0, ZoneOffset.UTC));

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            ReceiptPdfTestData.dump(doc, pdf, "comprovativo");
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
            String text = new PDFTextStripper().getText(doc);
            assertThat(text)
                    .contains("CP 2026/000001")
                    .contains("PAGO")
                    .contains("Ana Maria dos Santos")
                    .contains("NIF 5000000000")
                    .contains("Sony A7 III")
                    .contains("2 dias")
                    .contains("165.500 Kz")
                    .contains("331.000 Kz")
                    .contains("26.480 Kz")
                    .contains("80.000 Kz")
                    .contains("437.480 Kz")
                    .contains("quatrocentos e trinta e sete mil quatrocentos e oitenta kwanzas")
                    .contains("123 456 789")
                    .contains("15 out 2026, 14:32") // 13:32 UTC = 14:32 em Luanda
                    .contains("Documento não fiscal")
                    .contains("Página 1 de 1");
        }
    }

    @Test
    void nomesComCaracteresForaDaFonteNaoRebentam() throws Exception {
        Payment p = samplePayment();
        p.getRenter().setFullName("Zé 🚀 Ngola 李");
        byte[] pdf = new ReceiptService(null, null, new CompanyProperties(null, null, null, null), null)
                .render(p, OffsetDateTime.now());
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(new PDFTextStripper().getText(doc)).contains("Zé ? Ngola ?");
        }
    }
}
