package com.beeznoo.api.contract.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.common.pdf.CompanyProperties;
import com.beeznoo.api.common.pdf.PdfCanvas;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.contract.entity.Contract;
import com.beeznoo.api.contract.repository.ContractRepository;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.beeznoo.api.common.pdf.PdfCanvas.*;

/**
 * O contrato congelado da reserva em PDF: o texto exatamente como foi aceite, mais versão, SHA-256 e as datas de
 * aceitação de cada parte. Ver claude/decisoes-produto.md (2026-11-11).
 */
@Service
@Transactional(readOnly = true)
public class ContractPdfService {

    private static final String LABEL = "Contrato de aluguer";
    private static final Pattern SECTION = Pattern.compile("^\\d+\\.\\s+\\S.*");

    private final ContractRepository contractRepository;
    private final BookingRepository bookingRepository;
    private final ProfileRepository profileRepository;
    private final CompanyProperties company;

    public ContractPdfService(ContractRepository contractRepository, BookingRepository bookingRepository,
                              ProfileRepository profileRepository, CompanyProperties company) {
        this.contractRepository = contractRepository;
        this.bookingRepository = bookingRepository;
        this.profileRepository = profileRepository;
        this.company = company;
    }

    public record ContractFile(String fileName, byte[] content) {}

    public ContractFile pdf(UUID requesterId, UUID bookingId) {
        if (!bookingRepository.existsById(bookingId)) throw new IllegalArgumentException("Reserva não encontrada");
        Contract contract = contractRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new IllegalStateException("A reserva ainda não tem contrato (o dono ainda não aceitou)"));
        Booking booking = contract.getBooking();
        boolean party = booking.getRenter().getId().equals(requesterId) || booking.getOwner().getId().equals(requesterId);
        if (!party && !isAdmin(requesterId)) {
            throw new AccessDeniedException("Sem acesso ao contrato desta reserva");
        }
        return new ContractFile("contrato-reserva-" + shortId(bookingId) + ".pdf", render(contract));
    }

    byte[] render(Contract contract) {
        Booking booking = contract.getBooking();
        String ref = "Reserva " + shortId(booking.getId());

        try (PdfCanvas pdf = new PdfCanvas(LABEL + " — " + ref, booking.getItem().getTitle(),
                p -> p.brandBand(LABEL, ref))) {
            pdf.brandBand(LABEL, ref);

            List<String> lines = contract.getBody().lines().toList();
            int start = 0;
            // 1.ª linha = título; 2.ª = versão (vão para o cabeçalho)
            if (!lines.isEmpty()) {
                pdf.paragraph(lines.get(0), BOLD, 14, VERDE, MARGIN, CONTENT_WIDTH);
                start = 1;
            }
            if (lines.size() > 1 && lines.get(1).startsWith("Versão")) {
                pdf.gap(2);
                pdf.paragraph(lines.get(1), REGULAR, 8.5f, CINZA, MARGIN, CONTENT_WIDTH);
                start = 2;
            }
            pdf.gap(6);

            for (int i = start; i < lines.size(); i++) {
                String l = lines.get(i);
                if (l.isBlank()) {
                    pdf.gap(5);
                } else if (SECTION.matcher(l).matches()) {
                    pdf.ensure(40); // título de secção nunca fica sozinho no fim da página
                    pdf.gap(4);
                    pdf.paragraph(l, BOLD, 10.5f, VERDE, MARGIN, CONTENT_WIDTH);
                } else if (l.startsWith("[")) {
                    pdf.paragraph(l, BOLD, 9.5f, AMBAR_TEXT, MARGIN, CONTENT_WIDTH);
                } else {
                    pdf.paragraph(l, REGULAR, 9.5f, TEXTO, MARGIN, CONTENT_WIDTH);
                }
            }

            // ---- aceitação
            pdf.sectionTitle("Aceitação");
            pdf.labelValue("Dono", booking.getOwner().getFullName() + "  ·  aceite em "
                    + Formats.dateTime(contract.getOwnerAcceptedAt()), MARGIN, CONTENT_WIDTH, 100);
            pdf.labelValue("Arrendatário", booking.getRenter().getFullName() + "  ·  "
                    + (contract.getRenterAcceptedAt() == null ? "ainda não aceitou"
                       : "aceite em " + Formats.dateTime(contract.getRenterAcceptedAt())), MARGIN, CONTENT_WIDTH, 100);
            pdf.labelValue("Gerado em", Formats.dateTime(contract.getCreatedAt()), MARGIN, CONTENT_WIDTH, 100);
            pdf.labelValue("Versão do texto", contract.getVersion(), MARGIN, CONTENT_WIDTH, 100);

            pdf.gap(10);
            pdf.ensure(48); // nota e SHA-256 sempre juntos
            pdf.paragraph("A aceitação é feita na app Beeznoo, com sessão iniciada por cada parte. A impressão digital "
                    + "abaixo identifica este texto: qualquer alteração ao texto muda-a.", REGULAR, 8, CINZA,
                    MARGIN, CONTENT_WIDTH);
            pdf.paragraph("SHA-256: " + contract.getBodySha256(), REGULAR, 8, CINZA, MARGIN, CONTENT_WIDTH);

            if (contract.getVersion().toLowerCase(Locale.ROOT).contains("rascunho")) {
                pdf.watermarkAllPages("RASCUNHO");
            }
            return pdf.toBytes(company.legalName() + "  ·  beeznoo.ao  ·  " + LABEL + "  ·  " + ref);
        }
    }

    private static final java.awt.Color AMBAR_TEXT = new java.awt.Color(0x7A4A0B); // aviso-texto

    private static String shortId(UUID id) {
        return id.toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId).map(p -> p.getRole() == UserRole.ADMIN).orElse(false);
    }
}
