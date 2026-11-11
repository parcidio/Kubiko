package com.beeznoo.api.transaction.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.common.pdf.CompanyProperties;
import com.beeznoo.api.common.pdf.PdfCanvas;
import com.beeznoo.api.common.util.AmountInWords;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static com.beeznoo.api.common.pdf.PdfCanvas.*;

/**
 * Comprovativo de pagamento em PDF — documento NÃO fiscal (faturas e recibos fiscais exigem software certificado
 * pela AGT). Ver claude/decisoes-produto.md (2026-11-11).
 */
@Service
@Transactional(readOnly = true)
public class ReceiptService {

    private static final String RECEIPT_LABEL = "Comprovativo de pagamento";

    private final PaymentRepository paymentRepository;
    private final ProfileRepository profileRepository;
    private final CompanyProperties company;

    public ReceiptService(PaymentRepository paymentRepository, ProfileRepository profileRepository,
                          CompanyProperties company) {
        this.paymentRepository = paymentRepository;
        this.profileRepository = profileRepository;
        this.company = company;
    }

    public record ReceiptFile(String fileName, byte[] content) {}

    /** Só quem pagou (arrendatário) ou um admin; só pagamentos confirmados. */
    public ReceiptFile receipt(UUID requesterId, UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Pagamento não encontrado"));
        boolean renter = payment.getRenter().getId().equals(requesterId);
        if (!renter && !isAdmin(requesterId)) {
            throw new AccessDeniedException("Sem acesso a este comprovativo");
        }
        if (payment.getStatus() != PaymentStatus.CONFIRMED || payment.getReceiptNumber() == null) {
            throw new IllegalStateException("O comprovativo só existe depois de o pagamento ser confirmado");
        }
        String fileName = "comprovativo-" + payment.getReceiptNumber().replaceAll("[^A-Za-z0-9]+", "-") + ".pdf";
        return new ReceiptFile(fileName, render(payment, OffsetDateTime.now()));
    }

    byte[] render(Payment payment, OffsetDateTime issuedAt) {
        Booking booking = payment.getBooking();
        Profile client = payment.getRenter();
        String number = payment.getReceiptNumber();

        try (PdfCanvas pdf = new PdfCanvas(RECEIPT_LABEL + " " + number, "Reserva " + shortId(booking.getId()),
                p -> p.brandBand(RECEIPT_LABEL, number))) {
            pdf.brandBand(RECEIPT_LABEL, number);

            // ---- emitente (esquerda) e dados do documento (direita)
            float top = pdf.y();
            float colW = CONTENT_WIDTH / 2 - 12;
            pdf.line(company.legalName(), BOLD, 11, VERDE, MARGIN);
            if (notBlank(company.nif())) pdf.line("NIF " + company.nif(), REGULAR, 9, TEXTO, MARGIN);
            if (notBlank(company.address())) pdf.line(company.address(), REGULAR, 9, TEXTO, MARGIN);
            if (notBlank(company.email())) pdf.line(company.email() + "  ·  beeznoo.ao", REGULAR, 9, TEXTO, MARGIN);
            float leftBottom = pdf.y();

            pdf.moveTo(top);
            float rx = MARGIN + CONTENT_WIDTH / 2 + 12;
            pdf.labelValue("Nº do comprovativo", number, rx, colW, 108);
            pdf.labelValue("Data de emissão", Formats.dateTime(issuedAt), rx, colW, 108);
            pdf.labelValue("Data do pagamento", Formats.dateTime(payment.getConfirmedAt()), rx, colW, 108);
            pdf.labelValue("Reserva nº", shortId(booking.getId()), rx, colW, 108);
            pdf.moveTo(Math.min(leftBottom, pdf.y()));

            // ---- carimbo "PAGO" + valor em destaque
            pdf.gap(16);
            float boxH = 58;
            pdf.ensure(boxH);
            float boxBottom = pdf.y() - boxH;
            pdf.roundRect(MARGIN, boxBottom, CONTENT_WIDTH, boxH, 12, SALVIA_TINT, null, 0);
            pdf.roundRect(MARGIN + 16, boxBottom + 17, 62, 24, 6, null, VERDE_MEDIO, 1.6f);
            pdf.textAt("PAGO", BOLD, 13, VERDE_MEDIO, MARGIN + 30, boxBottom + 24);
            float nameWidth = CONTENT_WIDTH - 94 - 170;
            pdf.textAt("Recebemos de", REGULAR, 8.5f, CINZA, MARGIN + 94, boxBottom + 34);
            pdf.textAt(pdf.ellipsize(client.getFullName(), BOLD, 10.5f, nameWidth), BOLD, 10.5f, VERDE,
                    MARGIN + 94, boxBottom + 19);
            pdf.textRightAt("Total pago", REGULAR, 8.5f, CINZA, WIDTH - MARGIN - 16, boxBottom + 36);
            pdf.textRightAt(Formats.kz(payment.getAmount()), BOLD, 18, VERDE, WIDTH - MARGIN - 16, boxBottom + 16);
            pdf.moveTo(boxBottom);
            pdf.gap(4);
            pdf.paragraph("Por extenso: " + AmountInWords.kwanzas(payment.getAmount()) + ".", REGULAR, 8.5f, CINZA,
                    MARGIN + 2, CONTENT_WIDTH - 4);

            // ---- cliente (esquerda) e pagamento (direita)
            pdf.ensure(110);
            float colTop = pdf.y();
            float half = CONTENT_WIDTH / 2 - 12;
            pdf.sectionTitle("Cliente", MARGIN, half);
            pdf.labelValue("Nome", client.getFullName(), MARGIN, half, 62);
            pdf.labelValue("Telefone", client.getPhone(), MARGIN, half, 62);
            if (notBlank(client.getEmail())) pdf.labelValue("Email", client.getEmail(), MARGIN, half, 62);
            float clientBottom = pdf.y();

            pdf.moveTo(colTop);
            float px = MARGIN + CONTENT_WIDTH / 2 + 12;
            boolean manual = payment.getMethod() == PaymentMethod.MANUAL;
            pdf.sectionTitle("Pagamento", px, half);
            pdf.labelValue("Método", manual ? "Transferência validada pela equipa" : "Referência Multicaixa", px, half, 92);
            if (!manual && notBlank(payment.getReference())) {
                pdf.labelValue("Entidade / Ref.", payment.getEntity() + " / " + groupReference(payment.getReference()),
                        px, half, 92);
            }
            if (notBlank(payment.getProviderTransactionId())) {
                pdf.labelValue("ID da transação", payment.getProviderTransactionId(), px, half, 92);
            }
            pdf.moveTo(Math.min(clientBottom, pdf.y()));

            // ---- reserva
            long days = ChronoUnit.DAYS.between(booking.getStartDate(), booking.getEndDate());
            pdf.sectionTitle("Reserva");
            pdf.labelValue("Equipamento", booking.getItem().getTitle(), MARGIN, CONTENT_WIDTH, 120);
            pdf.labelValue("Dono", booking.getOwner().getFullName(), MARGIN, CONTENT_WIDTH, 120);
            pdf.labelValue("Período", Formats.date(booking.getStartDate()) + " a " + Formats.date(booking.getEndDate())
                    + "  (" + days + (days == 1 ? " dia)" : " dias)"), MARGIN, CONTENT_WIDTH, 120);
            String place = joinNonBlank(booking.getItem().getCity(), booking.getItem().getProvince());
            if (!place.isEmpty()) pdf.labelValue("Local", place, MARGIN, CONTENT_WIDTH, 120);

            // ---- linhas
            pdf.sectionTitle("Discriminação");
            itemsTable(pdf, payment, booking, days);

            // ---- notas
            pdf.gap(14);
            String depositNote = payment.getDepositAmount().signum() > 0
                    ? "A caução de " + Formats.kz(payment.getDepositAmount()) + " é reembolsável: volta para ti depois da "
                      + "devolução e inspeção do equipamento, salvo retenção por dano, perda ou roubo, nos termos do "
                      + "contrato da reserva. "
                    : "";
            notesBox(pdf, depositNote + "O valor do aluguer é entregue ao dono depois da entrega do equipamento. "
                    + "Guarda este comprovativo até a caução ser libertada.");

            pdf.gap(10);
            pdf.paragraph("Documento não fiscal. Não substitui fatura nem recibo emitidos por software certificado pela AGT.",
                    BOLD, 8, CINZA, MARGIN, CONTENT_WIDTH);
            pdf.paragraph("Código de verificação: " + payment.getId(), REGULAR, 8, CINZA, MARGIN, CONTENT_WIDTH);

            return pdf.toBytes(company.legalName() + "  ·  beeznoo.ao  ·  " + RECEIPT_LABEL + " " + number);
        }
    }

    private void itemsTable(PdfCanvas pdf, Payment payment, Booking booking, long days) {
        float cDesc = MARGIN + 10;
        float cQty = MARGIN + 290;
        float cUnitRight = MARGIN + 400;
        float cValueRight = WIDTH - MARGIN - 10;

        pdf.ensure(30);
        float headH = 22;
        float headBottom = pdf.y() - headH;
        pdf.roundRect(MARGIN, headBottom, CONTENT_WIDTH, headH, 6, VERDE, null, 0);
        pdf.textAt("Descrição", BOLD, 8.5f, BRANCO, cDesc, headBottom + 8);
        pdf.textAt("Qtd.", BOLD, 8.5f, BRANCO, cQty, headBottom + 8);
        pdf.textRightAt("Preço unit.", BOLD, 8.5f, BRANCO, cUnitRight, headBottom + 8);
        pdf.textRightAt("Valor", BOLD, 8.5f, BRANCO, cValueRight, headBottom + 8);
        pdf.moveTo(headBottom);

        BigDecimal rental = payment.getRentalAmount();
        boolean evenDaily = days > 0 && rental.remainder(BigDecimal.valueOf(days)).signum() == 0;
        String qty = evenDaily ? days + (days == 1 ? " dia" : " dias") : "1";
        String unit = evenDaily ? Formats.kz(rental.divide(BigDecimal.valueOf(days), 0, RoundingMode.HALF_UP))
                : Formats.kz(rental);
        row(pdf, "Aluguer: " + booking.getItem().getTitle(), qty, unit, Formats.kz(rental),
                cDesc, cQty, cUnitRight, cValueRight);

        String pct = feePercent(payment);
        row(pdf, "Taxa de serviço Beeznoo" + (pct == null ? "" : " (" + pct + " do aluguer)"), "1",
                Formats.kz(payment.getServiceFee()), Formats.kz(payment.getServiceFee()),
                cDesc, cQty, cUnitRight, cValueRight);

        if (payment.getDepositAmount().signum() > 0) {
            row(pdf, "Caução reembolsável", "1", Formats.kz(payment.getDepositAmount()),
                    Formats.kz(payment.getDepositAmount()), cDesc, cQty, cUnitRight, cValueRight);
        }

        // ---- totais
        pdf.gap(6);
        float labelRight = cUnitRight;
        totalLine(pdf, "Aluguer + taxa de serviço", Formats.kz(rental.add(payment.getServiceFee())), labelRight, cValueRight);
        if (payment.getDepositAmount().signum() > 0) {
            totalLine(pdf, "Caução (reembolsável)", Formats.kz(payment.getDepositAmount()), labelRight, cValueRight);
        }
        pdf.gap(4);
        pdf.ensure(30);
        float h = 28;
        float bottom = pdf.y() - h;
        float boxX = MARGIN + 250;
        pdf.roundRect(boxX, bottom, WIDTH - MARGIN - boxX, h, 8, AMBAR_TINT, null, 0);
        pdf.textRightAt("Total pago", BOLD, 10, VERDE, labelRight, bottom + 10);
        pdf.textRightAt(Formats.kz(payment.getAmount()), BOLD, 13, VERDE, cValueRight, bottom + 9);
        pdf.moveTo(bottom);
    }

    private static void row(PdfCanvas pdf, String desc, String qty, String unit, String value,
                            float cDesc, float cQty, float cUnitRight, float cValueRight) {
        var lines = pdf.wrap(desc, REGULAR, 9.5f, cQty - cDesc - 12);
        float h = 10 + lines.size() * 13;
        pdf.ensure(h);
        float top = pdf.y();
        float baseline = top - 16;
        for (String l : lines) {
            pdf.textAt(l, REGULAR, 9.5f, TEXTO, cDesc, baseline);
            baseline -= 13;
        }
        pdf.textAt(qty, REGULAR, 9.5f, TEXTO, cQty, top - 16);
        pdf.textRightAt(unit, REGULAR, 9.5f, TEXTO, cUnitRight, top - 16);
        pdf.textRightAt(value, BOLD, 9.5f, TEXTO, cValueRight, top - 16);
        float bottom = top - h;
        pdf.hLine(MARGIN, WIDTH - MARGIN, bottom, BORDA, 0.6f);
        pdf.moveTo(bottom);
    }

    private static void totalLine(PdfCanvas pdf, String label, String value, float labelRight, float valueRight) {
        pdf.ensure(18);
        float baseline = pdf.y() - 13;
        pdf.textRightAt(label, REGULAR, 9, CINZA, labelRight, baseline);
        pdf.textRightAt(value, REGULAR, 9.5f, TEXTO, valueRight, baseline);
        pdf.moveTo(pdf.y() - 18);
    }

    private static void notesBox(PdfCanvas pdf, String text) {
        var lines = pdf.wrap(text, REGULAR, 8.5f, CONTENT_WIDTH - 28);
        float h = 18 + lines.size() * 12;
        pdf.ensure(h);
        float bottom = pdf.y() - h;
        pdf.roundRect(MARGIN, bottom, CONTENT_WIDTH, h, 10, AREIA, BORDA, 0.6f);
        float baseline = pdf.y() - 15;
        for (String l : lines) {
            pdf.textAt(l, REGULAR, 8.5f, TEXTO, MARGIN + 14, baseline);
            baseline -= 12;
        }
        pdf.moveTo(bottom);
    }

    // 8% a partir do próprio pagamento (a taxa configurada pode ter mudado entretanto)
    private static String feePercent(Payment p) {
        if (p.getRentalAmount().signum() == 0) return null;
        BigDecimal pct = p.getServiceFee().multiply(BigDecimal.valueOf(100))
                .divide(p.getRentalAmount(), 0, RoundingMode.HALF_UP);
        return pct.toPlainString() + "%";
    }

    private static String groupReference(String ref) {
        return ref.replaceAll("(\\d{3})(?=\\d)", "$1 ");
    }

    static String shortId(UUID id) {
        return id.toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String joinNonBlank(String a, String b) {
        if (notBlank(a) && notBlank(b)) return a + ", " + b;
        return notBlank(a) ? a : notBlank(b) ? b : "";
    }

    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId).map(p -> p.getRole() == UserRole.ADMIN).orElse(false);
    }
}
