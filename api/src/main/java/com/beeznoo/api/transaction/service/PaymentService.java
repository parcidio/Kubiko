package com.beeznoo.api.transaction.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.deposit.service.DepositService;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.transaction.config.PaymentProperties;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.dto.PaymentDtos.AdminPaymentItem;
import com.beeznoo.api.transaction.dto.PaymentDtos.CommissionDue;
import com.beeznoo.api.transaction.dto.PaymentDtos.CommissionLine;
import com.beeznoo.api.transaction.dto.PaymentDtos.MyCommissions;
import com.beeznoo.api.transaction.dto.PaymentDtos.PaymentResponse;
import com.beeznoo.api.transaction.dto.PaymentDtos.SettleCommissionsResponse;
import com.beeznoo.api.transaction.entity.DirectChannel;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.entity.PaymentMethod;
import com.beeznoo.api.transaction.entity.PaymentStatus;
import com.beeznoo.api.transaction.gateway.PaymentGateway;
import com.beeznoo.api.transaction.gateway.PaymentGateway.GatewayStatus;
import com.beeznoo.api.transaction.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Pagamento de uma reserva ACCEPTED. Dois modos (app.payments.mode):
 * - direct (omissão): o arrendatário paga ao dono na entrega e o dono confirma (decisoes-produto.md 2026-11-15).
 *   A Beeznoo não recebe o dinheiro: sem ledger; a taxa de serviço fica como comissão a cobrar ao dono.
 * - reference: referência Multicaixa paga à Beeznoo (2026-10-16), liquidada no ledger.
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
    private final NotificationService notificationService;
    private final ServiceFees serviceFees;
    private final ContractService contractService;
    private final DepositService depositService;
    private final AuditService auditService;
    private final ProfileRepository profileRepository;

    public PaymentService(PaymentRepository paymentRepository, BookingRepository bookingRepository,
                          LedgerService ledgerService, PaymentGateway gateway, PaymentProperties properties,
                          NotificationService notificationService, ServiceFees serviceFees,
                          ContractService contractService, DepositService depositService,
                          AuditService auditService, ProfileRepository profileRepository) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.ledgerService = ledgerService;
        this.gateway = gateway;
        this.properties = properties;
        this.notificationService = notificationService;
        this.serviceFees = serviceFees;
        this.contractService = contractService;
        this.depositService = depositService;
        this.auditService = auditService;
        this.profileRepository = profileRepository;
    }

    public boolean directMode() {
        return properties.direct();
    }

    // Emite a referência; se já houver uma válida em aberto, devolve essa (idempotente)
    public PaymentResponse createReference(UUID renterId, UUID bookingId) {
        assertReferenceMode();
        Booking booking = findBooking(bookingId);
        assertRenter(renterId, booking);
        assertAccepted(booking);
        contractService.assertRenterAccepted(bookingId);

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
        // partes da reserva ou ADMIN (detalhe da reserva no portal da equipa)
        if (!booking.getOwner().getId().equals(requesterId) && !isAdmin(requesterId)) assertRenter(requesterId, booking);
        return paymentRepository.findFirstByBookingIdOrderByCreatedAtDesc(bookingId).map(PaymentResponse::from);
    }

    // "Já paguei" — pergunta ao gateway e, se pago, liquida a reserva
    public PaymentResponse check(UUID renterId, UUID paymentId) {
        // lock: o PaymentExpiryScheduler não pode expirar a referência a meio da liquidação
        Payment payment = paymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Pagamento não encontrado"));
        assertRenter(renterId, payment.getBooking());
        if (!payment.isOpen()) return PaymentResponse.from(payment);
        assertReferenceMode();

        if (payment.isExpiredAt(OffsetDateTime.now())) {
            payment.setStatus(PaymentStatus.EXPIRED);
            return PaymentResponse.from(payment);
        }

        GatewayStatus status = gateway.checkStatus(payment);
        switch (status.state()) {
            case PAID -> settle(payment, status.transactionId());
            case FAILED -> payment.setStatus(PaymentStatus.FAILED);
            // continua à espera; a equipa é avisada para validar à mão
            case PENDING -> notificationService.paymentAwaitingValidation(payment.getBooking(), payment.getAmount());
        }
        return PaymentResponse.from(payment);
    }

    // Modo direct: o dono (ou um admin em nome dele) confirma que recebeu o pagamento na entrega.
    // Sem ledger — o dinheiro não passa pela Beeznoo. A taxa de serviço fica como comissão a cobrar ao dono.
    public PaymentResponse confirmDirect(UUID confirmerId, Booking booking, DirectChannel channel) {
        if (!properties.direct()) {
            throw new IllegalStateException("O pagamento direto ao dono não está ativo");
        }
        if (channel == null) throw new IllegalArgumentException("Indica como foi feito o pagamento");
        assertAccepted(booking);
        if (!contractService.isRenterAccepted(booking.getId())) {
            throw new IllegalStateException("O arrendatário ainda não aceitou o contrato");
        }
        if (paymentRepository.existsByBookingIdAndStatus(booking.getId(), PaymentStatus.CONFIRMED)) {
            throw new IllegalStateException("O pagamento desta reserva já foi confirmado");
        }
        OffsetDateTime now = OffsetDateTime.now();
        Payment payment = newPayment(booking, PaymentMethod.DIRECT, channel.name(), now);
        payment.setConfirmedBy(profileRepository.getReferenceById(confirmerId));
        paymentRepository.save(payment);
        markConfirmed(payment, null);
        return PaymentResponse.from(payment);
    }

    // Validação manual pelo admin (comprovativo). Usa a referência aberta ou cria um registo MANUAL.
    public void confirmManually(Booking booking) {
        assertReferenceMode();
        assertAccepted(booking);
        contractService.assertRenterAccepted(booking.getId());
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

    // Por pagar: mais antigos primeiro (fila). Confirmados: mais recentes primeiro (histórico).
    @Transactional(readOnly = true)
    public Page<AdminPaymentItem> adminQueue(PaymentStatus status, Pageable pageable) {
        Page<Payment> page = status == PaymentStatus.CONFIRMED
                ? paymentRepository.findByStatusOrderByCreatedAtDesc(status, pageable)
                : paymentRepository.findByStatusOrderByCreatedAtAsc(status, pageable);
        return page.map(AdminPaymentItem::from);
    }

    // ── Comissões (modo direct) ──────────────────────────────────────────

    // Admin: o que cada dono deve, quem deve há mais tempo primeiro
    @Transactional(readOnly = true)
    public List<CommissionDue> commissionsDue() {
        Map<UUID, List<Payment>> byOwner = new LinkedHashMap<>();
        for (Payment p : paymentRepository.findCommissionsDue()) {
            byOwner.computeIfAbsent(p.getBooking().getOwner().getId(), k -> new java.util.ArrayList<>()).add(p);
        }
        return byOwner.values().stream().map(list -> {
            Profile owner = list.getFirst().getBooking().getOwner();
            return new CommissionDue(owner.getId(), owner.getFullName(), owner.getPhone(), list.size(),
                    sumFees(list), list.getFirst().getConfirmedAt());
        }).toList();
    }

    // Carteira do dono: total em dívida + últimos pagamentos recebidos
    @Transactional(readOnly = true)
    public MyCommissions myCommissions(UUID ownerId) {
        List<Payment> received = paymentRepository.findDirectReceivedBy(ownerId, PageRequest.of(0, 50));
        return new MyCommissions(paymentRepository.sumCommissionDue(ownerId),
                received.stream().map(CommissionLine::from).toList());
    }

    // A equipa recebeu do dono todas as comissões em aberto (pagamento combinado fora da app)
    public SettleCommissionsResponse settleCommissions(UUID adminId, UUID ownerId, String reason) {
        List<Payment> due = paymentRepository.findCommissionsDueForUpdate(ownerId);
        if (due.isEmpty()) throw new IllegalStateException("Este dono não tem comissões por pagar");
        OffsetDateTime now = OffsetDateTime.now();
        Profile admin = profileRepository.getReferenceById(adminId);
        for (Payment p : due) {
            p.setCommissionSettledAt(now);
            p.setCommissionSettledBy(admin);
        }
        BigDecimal total = sumFees(due);
        auditService.record(adminId, AuditAction.COMMISSION_SETTLED, AuditService.ACCOUNT, ownerId, reason,
                Map.<String, Object>of("amount", total.toPlainString(), "payments", due.size(),
                        "paymentIds", due.stream().map(p -> p.getId().toString()).toList()));
        log.info("Comissões de {} pagamento(s) do dono {} registadas como recebidas", due.size(), ownerId);
        return new SettleCommissionsResponse(ownerId, due.size(), total);
    }

    private static BigDecimal sumFees(List<Payment> payments) {
        return payments.stream().map(Payment::getServiceFee).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // Reserva cancelada — a referência em aberto deixa de poder ser paga
    public void cancelOpen(UUID bookingId) {
        paymentRepository.findByBookingIdAndStatus(bookingId, PaymentStatus.AWAITING_PAYMENT)
                .ifPresent(p -> p.setStatus(PaymentStatus.CANCELLED));
    }

    private void settle(Payment payment, String transactionId) {
        assertAccepted(payment.getBooking());
        ledgerService.settleReferencePayment(payment);
        markConfirmed(payment, transactionId);
    }

    // Comum aos dois modos: caução registada, comprovativo, reserva ACTIVE, avisos
    private void markConfirmed(Payment payment, String transactionId) {
        Booking booking = payment.getBooking();
        depositService.recordHeld(booking);

        OffsetDateTime confirmedAt = OffsetDateTime.now();
        // Pedir o número ANTES de mudar o estado: o nextval faz flush, e CONFIRMED sem número viola a constraint (V19)
        String receiptNumber = receiptNumber(confirmedAt);
        payment.setStatus(PaymentStatus.CONFIRMED);
        payment.setConfirmedAt(confirmedAt);
        payment.setReceiptNumber(receiptNumber);
        payment.setProviderTransactionId(transactionId);
        booking.setStatus(BookingStatus.ACTIVE);
        if (payment.getMethod() == PaymentMethod.DIRECT) {
            notificationService.directPaymentConfirmed(booking, payment.getAmount(), DirectChannel.labelOf(payment.getProvider()));
        } else {
            notificationService.paymentConfirmed(booking, payment.getAmount());
        }
        // Sem referência nem montante no log (CLAUDE.md §6)
        log.info("Pagamento {} confirmado — reserva {} ACTIVE", payment.getId(), booking.getId());
    }

    // "CP 2026/000001" — comprovativo não fiscal (decisoes-produto.md 2026-11-11)
    private String receiptNumber(OffsetDateTime confirmedAt) {
        int year = confirmedAt.atZoneSameInstant(Formats.LUANDA).getYear();
        return String.format("CP %d/%06d", year, paymentRepository.nextReceiptSequence());
    }

    private Payment newPayment(Booking booking, PaymentMethod method, String provider, OffsetDateTime expiresAt) {
        BigDecimal rental = booking.getTotalPrice();
        BigDecimal deposit = booking.getDepositAmount() == null ? BigDecimal.ZERO : booking.getDepositAmount();
        BigDecimal fee = serviceFees.of(rental);
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

    private void assertReferenceMode() {
        if (properties.direct()) {
            throw new IllegalStateException("Nesta fase não há referência: pagas ao dono quando levantas o equipamento");
        }
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

    // Leitura de admin: só quem tem a área Operação (reservas, pagamentos, cauções, problemas)
    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId)
                .map(p -> p.hasAdminPermission(com.beeznoo.api.profile.entity.AdminPermission.OPERATIONS_DESK))
                .orElse(false);
    }

}
