package com.beeznoo.api.contract.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.contract.dto.ContractDtos.ContractResponse;
import com.beeznoo.api.contract.entity.Contract;
import com.beeznoo.api.contract.repository.ContractRepository;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.service.ServiceFees;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Contrato por reserva. Ver claude/decisoes-produto.md (2026-10-23).
 * O texto v1 é um RASCUNHO TÉCNICO — rever com jurista antes do primeiro aluguer real.
 * Sem BI/NIF no texto: as partes identificam-se pelo nome e pelo KYC aprovado na Beeznoo.
 */
@Service
@Transactional
public class ContractService {

    public static final String CURRENT_VERSION = "v1-rascunho";
    private static final String TEMPLATE = "contracts/aluguer-v1.txt";

    private final ContractRepository contractRepository;
    private final BookingRepository bookingRepository;
    private final ProfileRepository profileRepository;
    private final ServiceFees serviceFees;
    private final String template;

    public ContractService(ContractRepository contractRepository, BookingRepository bookingRepository,
                           ProfileRepository profileRepository, ServiceFees serviceFees) {
        this.contractRepository = contractRepository;
        this.bookingRepository = bookingRepository;
        this.profileRepository = profileRepository;
        this.serviceFees = serviceFees;
        try {
            this.template = new ClassPathResource(TEMPLATE).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Modelo de contrato em falta: " + TEMPLATE, e);
        }
    }

    // Chamado quando o dono aceita: aceitar o pedido conta como aceitação do dono
    public Contract generateOnAccept(Booking booking) {
        if (contractRepository.findByBookingId(booking.getId()).isPresent()) {
            throw new IllegalStateException("A reserva já tem contrato");
        }
        String body = render(booking);
        return contractRepository.save(Contract.builder()
                .booking(booking)
                .version(CURRENT_VERSION)
                .body(body)
                .bodySha256(sha256(body))
                .ownerAcceptedAt(OffsetDateTime.now())
                .build());
    }

    @Transactional(readOnly = true)
    public ContractResponse get(UUID requesterId, UUID bookingId) {
        Contract contract = findByBooking(bookingId);
        Booking booking = contract.getBooking();
        boolean party = booking.getRenter().getId().equals(requesterId) || booking.getOwner().getId().equals(requesterId);
        if (!party && !isAdmin(requesterId)) {
            throw new AccessDeniedException("Sem acesso ao contrato desta reserva");
        }
        return ContractResponse.from(contract);
    }

    public ContractResponse acceptAsRenter(UUID renterId, UUID bookingId) {
        Contract contract = findByBooking(bookingId);
        Booking booking = contract.getBooking();
        if (!booking.getRenter().getId().equals(renterId)) {
            throw new AccessDeniedException("Só o arrendatário pode aceitar este contrato");
        }
        if (booking.getStatus() != BookingStatus.ACCEPTED) {
            throw new IllegalStateException("O contrato só pode ser aceite enquanto a reserva espera pagamento");
        }
        if (contract.getRenterAcceptedAt() == null) contract.setRenterAcceptedAt(OffsetDateTime.now());
        return ContractResponse.from(contract);
    }

    // Gate do pagamento
    @Transactional(readOnly = true)
    public void assertRenterAccepted(UUID bookingId) {
        if (!contractRepository.existsByBookingIdAndRenterAcceptedAtIsNotNull(bookingId)) {
            throw new IllegalStateException("Aceita o contrato antes de pagar");
        }
    }

    String render(Booking b) {
        BigDecimal rental = b.getTotalPrice();
        BigDecimal deposit = b.getDepositAmount() == null ? BigDecimal.ZERO : b.getDepositAmount();
        BigDecimal fee = serviceFees.of(rental);
        Map<String, String> values = Map.ofEntries(
                Map.entry("version", CURRENT_VERSION),
                Map.entry("bookingId", b.getId().toString()),
                Map.entry("ownerName", b.getOwner().getFullName()),
                Map.entry("renterName", b.getRenter().getFullName()),
                Map.entry("itemTitle", b.getItem().getTitle()),
                Map.entry("itemCondition", b.getItem().getCondition().name()),
                Map.entry("startDate", Formats.date(b.getStartDate())),
                Map.entry("endDate", Formats.date(b.getEndDate())),
                Map.entry("days", Long.toString(ChronoUnit.DAYS.between(b.getStartDate(), b.getEndDate()))),
                Map.entry("rentalAmount", Formats.kz(rental)),
                Map.entry("serviceFee", Formats.kz(fee)),
                Map.entry("depositAmount", Formats.kz(deposit)),
                Map.entry("totalAmount", Formats.kz(rental.add(fee).add(deposit)))
        );
        String out = template;
        for (var e : values.entrySet()) out = out.replace("{{" + e.getKey() + "}}", e.getValue());
        return out;
    }

    private Contract findByBooking(UUID bookingId) {
        if (!bookingRepository.existsById(bookingId)) throw new IllegalArgumentException("Reserva não encontrada");
        return contractRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new IllegalStateException("A reserva ainda não tem contrato (o dono ainda não aceitou)"));
    }

    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId).map(p -> p.getRole() == UserRole.ADMIN).orElse(false);
    }

    private static String sha256(String body) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
