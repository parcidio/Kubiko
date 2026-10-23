package com.beeznoo.api.transaction.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.transaction.config.PaymentProperties;
import com.beeznoo.api.transaction.dto.PaymentDtos.PaymentResponse;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import com.beeznoo.api.transaction.gateway.PaymentGateway;
import com.beeznoo.api.transaction.gateway.PaymentGateway.GatewayStatus;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Pagamento por referência de uma reserva ACCEPTED. Ver claude/decisoes-produto.md (2026-10-16).
 * Não depende do BookingService (o BookingService é que chama este serviço), para evitar ciclos.
 */
@Slf4j
@Service
@Transactional
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final LedgerService ledgerService;
    private final PaymentGateway gateway;
    private final PaymentProperties properties;

    public PaymentService(PaymentRepository paymentRepository, BookingRepository bookingRepository,
                          LedgerService ledgerService, PaymentGateway gateway, PaymentProperties properties) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.ledgerService = ledgerService;
        this.gateway = gateway;
        this.properties = properties;
    }

    // Emite a referência; se já houver uma válida em aberto, devolve essa (idempotente)
    public PaymentResponse createReference(UUID renterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        assertRenter(renterId, booking);
        assertAccepted(booking);

        OffsetDateTime now = OffsetDateTime.now();
        Optional<Payment> open = paymentRepository.findByBookingIdAndStatus(bookingId, PaymentStatus.AWAITING_PAYMENT);
        if (open.isPresent()) {
            if (!open.get().isExpiredAt(now)) return PaymentResponse.from(open.get());
            open.get().setStatus(PaymentStatus.EXPIRED);
            paymentRepository.flush(); // liberta o índice único de "uma em aberto" antes de inserir a nova
        }

        Payment payment = newPayment(booking, PaymentMethod.REFERENCE, gateway.provider(), now.plus(properties.referenceTtl()));
        PaymentGateway.IssuedReference issued = gateway.issueReference(payment.getAmount(), payment.getExpiresAt());
        payment.setEntity(issued.entity());
        payment.setReference(issued.reference());
        return PaymentResponse.from(paymentRepository.save(payment));
    }

    // Arrendatário e dono podem ver o estado do pagamento
    @Transactional(readOnly = true)
    public Optional<PaymentResponse> findCurrent(UUID requesterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        if (!booking.getOwner().getId().equals(requesterId)) assertRenter(requesterId, booking);
        return paymentRepository.findFirstByBookingIdOrderByCreatedAtDesc(bookingId).map(PaymentResponse::from);
    }

    // "Já paguei" — pergunta ao gateway e, se pago, liquida a reserva
    public PaymentResponse check(UUID renterId, UUID paymentId) {
        // lock: o PaymentExpiryScheduler não pode expirar a referência a meio da liquidação
        Payment payment = paymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Pagamento não encontrado"));
        assertRenter(renterId, payment.getBooking());
        if (!payment.isOpen()) return PaymentResponse.from(payment);

        if (payment.isExpiredAt(OffsetDateTime.now())) {
            payment.setStatus(PaymentStatus.EXPIRED);
            return PaymentResponse.from(payment);
        }

        GatewayStatus status = gateway.checkStatus(payment);
        switch (status.state()) {
            case PAID -> settle(payment, status.transactionId());
            case FAILED -> payment.setStatus(PaymentStatus.FAILED);
            case PENDING -> { /* continua à espera */ }
        }
        return PaymentResponse.from(payment);
    }

    // Validação manual pelo admin (comprovativo). Usa a referência aberta ou cria um registo MANUAL.
    public void confirmManually(Booking booking) {
        assertAccepted(booking);
        Payment payment = paymentRepository
                .findByBookingIdAndStatus(booking.getId(), PaymentStatus.AWAITING_PAYMENT)
                .orElseGet(() -> paymentRepository.save(
                        newPayment(booking, PaymentMethod.MANUAL, "MANUAL", OffsetDateTime.now())));
        settle(payment, null);
    }

    @Transactional(readOnly = true)
    public List<UUID> findOverdueIds() {
        return paymentRepository.findIdsByStatusAndExpiresAtBefore(PaymentStatus.AWAITING_PAYMENT, OffsetDateTime.now());
    }

    // Chamado pelo PaymentExpiryScheduler. A reserva continua ACCEPTED e pode gerar nova referência;
    // não há valores a libertar porque a retenção só acontece na confirmação.
    public void expire(UUID paymentId) {
        paymentRepository.findByIdForUpdate(paymentId)
                .filter(p -> p.isExpiredAt(OffsetDateTime.now()))
                .ifPresent(p -> {
                    p.setStatus(PaymentStatus.EXPIRED);
                    log.info("Pagamento {} expirado — reserva {} continua ACCEPTED", p.getId(), p.getBooking().getId());
                });
    }

    // Reserva cancelada — a referência em aberto deixa de poder ser paga
    public void cancelOpen(UUID bookingId) {
        paymentRepository.findByBookingIdAndStatus(bookingId, PaymentStatus.AWAITING_PAYMENT)
                .ifPresent(p -> p.setStatus(PaymentStatus.CANCELLED));
    }

    private void settle(Payment payment, String transactionId) {
        Booking booking = payment.getBooking();
        assertAccepted(booking);
        ledgerService.settleReferencePayment(payment);

        payment.setStatus(PaymentStatus.CONFIRMED);
        payment.setConfirmedAt(OffsetDateTime.now());
        payment.setProviderTransactionId(transactionId);
        booking.setStatus(BookingStatus.ACTIVE);
        // Sem referência nem montante no log (CLAUDE.md §6)
        log.info("Pagamento {} confirmado — reserva {} ACTIVE", payment.getId(), booking.getId());
    }

    private Payment newPayment(Booking booking, PaymentMethod method, String provider, OffsetDateTime expiresAt) {
        BigDecimal rental = booking.getTotalPrice();
        BigDecimal deposit = booking.getDepositAmount() == null ? BigDecimal.ZERO : booking.getDepositAmount();
        // Kz inteiros: a taxa arredonda ao kwanza
        BigDecimal fee = rental.multiply(properties.serviceFeeRate()).setScale(0, RoundingMode.HALF_UP).setScale(2);
        return Payment.builder()
                .booking(booking)
                .renter(booking.getRenter())
                .method(method)
                .provider(provider)
                .rentalAmount(rental)
                .serviceFee(fee)
                .depositAmount(deposit)
                .amount(rental.add(fee).add(deposit))
                .expiresAt(expiresAt)
                .build();
    }

    private Booking findBooking(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }

    private void assertRenter(UUID requesterId, Booking booking) {
        if (!booking.getRenter().getId().equals(requesterId)) {
            throw new AccessDeniedException("Só o arrendatário pode pagar esta reserva");
        }
    }

    private void assertAccepted(Booking booking) {
        if (booking.getStatus() != BookingStatus.ACCEPTED) {
            throw new IllegalStateException("A reserva não está à espera de pagamento");
        }
    }
}
