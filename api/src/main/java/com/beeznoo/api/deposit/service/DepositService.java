package com.beeznoo.api.deposit.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.deposit.dto.DepositDtos.DepositResponse;
import com.beeznoo.api.deposit.entity.Deposit;
import com.beeznoo.api.deposit.entity.DepositStatus;
import com.beeznoo.api.deposit.repository.DepositRepository;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.service.LedgerService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Caução de cada reserva paga (SPEC §5, §8 opção B). O dinheiro mexe-se no ledger; aqui fica o estado e a decisão.
 * O admin decide depois da devolução (RETURNED) ou de um problema (DISPUTED); a reserva passa a COMPLETED.
 * Ver claude/decisoes-produto.md (2026-10-23).
 */
@Service
@Transactional
public class DepositService {

    // Reservas em que a caução pode ser decidida
    static final List<BookingStatus> DECIDABLE = List.of(BookingStatus.RETURNED, BookingStatus.DISPUTED);

    private final DepositRepository depositRepository;
    private final LedgerService ledgerService;
    private final ProfileRepository profileRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public DepositService(DepositRepository depositRepository, LedgerService ledgerService,
                          ProfileRepository profileRepository, AuditService auditService,
                          NotificationService notificationService) {
        this.depositRepository = depositRepository;
        this.ledgerService = ledgerService;
        this.profileRepository = profileRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    // Chamado na liquidação do pagamento (o ledger já registou DEPOSIT_HOLD)
    public void recordHeld(Booking booking) {
        BigDecimal amount = booking.getDepositAmount();
        if (amount == null || amount.signum() <= 0) return;
        depositRepository.save(Deposit.builder()
                .booking(booking)
                .amount(amount)
                .heldAt(OffsetDateTime.now())
                .build());
    }

    @Transactional(readOnly = true)
    public Page<DepositResponse> queue(Pageable pageable) {
        return depositRepository.findQueue(DepositStatus.HELD, DECIDABLE, pageable).map(DepositResponse::from);
    }

    @Transactional(readOnly = true)
    public boolean hasHeldDeposit(UUID bookingId) {
        return depositRepository.findByBookingId(bookingId).map(d -> d.getStatus() == DepositStatus.HELD).orElse(false);
    }

    public DepositResponse release(UUID adminId, UUID bookingId, String reason) {
        Deposit deposit = lockHeld(bookingId);
        Booking booking = deposit.getBooking();
        assertDecidable(booking);

        ledgerService.completeBooking(bookingId);
        decide(deposit, adminId, DepositStatus.RELEASED, BigDecimal.ZERO, reason);
        booking.setStatus(BookingStatus.COMPLETED);

        auditService.record(adminId, AuditAction.DEPOSIT_RELEASED, AuditService.BOOKING, bookingId, reason,
                Map.of("amount", deposit.getAmount().toPlainString()));
        notificationService.depositReleased(booking, deposit.getAmount());
        return DepositResponse.from(deposit);
    }

    public DepositResponse withhold(UUID adminId, UUID bookingId, BigDecimal amount, String reason) {
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Indica o motivo da retenção");
        Deposit deposit = lockHeld(bookingId);
        Booking booking = deposit.getBooking();
        assertDecidable(booking);
        BigDecimal withheld = amount.setScale(2);
        if (withheld.compareTo(deposit.getAmount()) > 0) {
            throw new IllegalArgumentException("Não podes reter mais do que a caução");
        }

        ledgerService.withholdDeposit(bookingId, withheld);
        decide(deposit, adminId, DepositStatus.WITHHELD, withheld, reason.strip());
        booking.setStatus(BookingStatus.COMPLETED);

        BigDecimal returned = deposit.getAmount().subtract(withheld);
        auditService.record(adminId, AuditAction.DEPOSIT_WITHHELD, AuditService.BOOKING, bookingId, reason,
                Map.of("amount", deposit.getAmount().toPlainString(), "withheld", withheld.toPlainString(),
                        "returned", returned.toPlainString()));
        notificationService.depositWithheld(booking, withheld, returned, reason.strip());
        return DepositResponse.from(deposit);
    }

    private void decide(Deposit deposit, UUID adminId, DepositStatus status, BigDecimal withheld, String reason) {
        deposit.setStatus(status);
        deposit.setWithheldAmount(withheld);
        deposit.setReason(reason == null || reason.isBlank() ? null : reason.strip());
        deposit.setDecidedBy(profileRepository.getReferenceById(adminId));
        deposit.setDecidedAt(OffsetDateTime.now());
    }

    private Deposit lockHeld(UUID bookingId) {
        Deposit deposit = depositRepository.findByBookingIdForUpdate(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("A reserva não tem caução"));
        if (deposit.getStatus() != DepositStatus.HELD) {
            throw new IllegalStateException("A caução já foi decidida");
        }
        return deposit;
    }

    private static void assertDecidable(Booking booking) {
        if (!DECIDABLE.contains(booking.getStatus())) {
            throw new IllegalStateException("A caução só se decide depois da devolução ou de um problema reportado");
        }
    }
}
