package com.beeznoo.api.transaction.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.item.entity.Category;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemCondition;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;

import javax.imageio.ImageIO;
import java.io.File;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/** Dados de exemplo para os testes dos PDFs (sem BD). */
public final class ReceiptPdfTestData {

    private ReceiptPdfTestData() {}

    public static Booking booking() {
        Profile renter = Profile.builder().id(UUID.randomUUID()).fullName("Ana Maria dos Santos")
                .phone("+244923456789").email("ana@exemplo.ao").build();
        Profile owner = Profile.builder().id(UUID.randomUUID()).fullName("Estúdio Kianda, Lda.")
                .phone("+244912000000").build();
        Item item = Item.builder().id(UUID.randomUUID()).owner(owner)
                .category(Category.builder().name("Fotografia").slug("fotografia").build())
                .title("Sony A7 III com lente 24-70mm f/2.8 GM")
                .condition(ItemCondition.LIKE_NEW).pricePerDay(new BigDecimal("165500.00"))
                .province("Luanda").city("Talatona").build();
        return Booking.builder().id(UUID.fromString("3f2a9c1e-0000-4000-8000-000000000001"))
                .item(item).renter(renter).owner(owner)
                .startDate(LocalDate.of(2026, 10, 16)).endDate(LocalDate.of(2026, 10, 18))
                .totalPrice(new BigDecimal("331000.00")).depositAmount(new BigDecimal("80000.00"))
                .status(BookingStatus.ACTIVE).build();
    }

    public static Payment payment() {
        Booking booking = booking();
        return Payment.builder().id(UUID.randomUUID()).booking(booking).renter(booking.getRenter())
                .method(PaymentMethod.REFERENCE).provider("SIMULATED").entity("00000").reference("123456789")
                .rentalAmount(new BigDecimal("331000.00")).serviceFee(new BigDecimal("26480.00"))
                .depositAmount(new BigDecimal("80000.00")).amount(new BigDecimal("437480.00"))
                .status(PaymentStatus.CONFIRMED).providerTransactionId("MCX-20261015-88412")
                .confirmedAt(OffsetDateTime.of(2026, 10, 15, 13, 32, 0, 0, ZoneOffset.UTC))
                .receiptNumber("CP 2026/000001").build();
    }

    /** Com -Dpdf.out=<pasta> grava o PDF e um PNG por página, para rever o aspeto. */
    public static void dump(PDDocument doc, byte[] pdf, String name) throws Exception {
        String out = System.getProperty("pdf.out");
        if (out == null) return;
        Files.write(new File(out, name + ".pdf").toPath(), pdf);
        PDFRenderer renderer = new PDFRenderer(doc);
        for (int i = 0; i < doc.getNumberOfPages(); i++) {
            ImageIO.write(renderer.renderImageWithDPI(i, 110), "png", new File(out, name + "-" + (i + 1) + ".png"));
        }
    }
}
