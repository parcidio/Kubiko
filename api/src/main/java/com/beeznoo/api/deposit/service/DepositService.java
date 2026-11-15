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
import com.beeznoo.api.transaction.config.PaymentProperties;
import com.beeznoo.api.transaction.service.LedgerService;
import org.springframework.security.access.AccessDeniedException;
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
 *
 * Modo direct (2026-11-15): a caução está com o dono, não com a Beeznoo. Depois da devolução é o dono que indica se a
 * devolveu toda ou se reteve parte (reserva COMPLETED). O admin só decide em DISPUTED, como mediação. Sem ledger.
 */
@Service
@Transactional
public class DepositService {

    // Reservas em que a caução pode ser decidida
    static final List<BookingStatus> DECIDABLE = List.of(BookingStatus.RETURNED, BookingStatus.DISPUTED);
    // Modo direct: prazo para o arrendatário contestar a decisão do dono sobre a caução
    public static final java.time.Duration CONTEST_WINDOW = java.time.Duration.ofDays(7);

    private final DepositRepository depositRepository;
    private final LedgerService ledgerService;
    private final ProfileRepository profileRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final PaymentProperties paymentProperties;

    public DepositService(DepositRepository depositRepository, LedgerService ledgerService,
                          ProfileRepository profileRepository, AuditService auditService,
                          NotificationService notificationService, PaymentProperties paymentProperties) {
        this.depositRepository = depositRepository;
        this.ledgerService = ledgerService;
        this.profileRepository = profileRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.paymentProperties = paymentProperties;
    }

    // Devolução confirmada pelas duas partes (ChecklistService)
    public void afterReturn(Booking booking) {
        if (!paymentProperties.direct()) {
            notificationService.bookingReturned(booking); // a equipa decide a caução
            return;
        }
        if (hasHeldDeposit(booking.getId())) {
            notificationService.depositToReturn(booking); // o dono devolve a caução que tem com ele
        } else {
            booking.setStatus(BookingStatus.COMPLETED); // sem caução não há nada a decidir
        }
    }

    // Modo direct: o dono indica o que fez com a caução que recebeu na entrega. withheld = 0 → devolveu tudo.
    public DepositResponse decideAsOwner(UUID ownerId, UUID bookingId, BigDecimal withheldAmount, String reason) {
        if (!paymentProperties.direct()) {
            throw new IllegalStateException("A caução é decidida pela equipa Beeznoo");
        }
        Deposit deposit = lockHeld(bookingId);
        Booking booking = deposit.getBooking();
        if (!booking.getOwner().getId().equals(ownerId)) {
            throw new AccessDeniedException("Só o dono pode registar a devolução da caução");
        }
        if (booking.getStatus() != BookingStatus.RETURNED) {
            throw new IllegalStateException(booking.getStatus() == BookingStatus.DISPUTED
                    ? "Há um problema reportado: a equipa Beeznoo decide a caução"
                    : "A caução só se devolve depois de a devolução ser confirmada");
        }
        BigDecimal withheld = withheldAmount == null ? BigDecimal.ZERO : withheldAmount.setScale(2, java.math.RoundingMode.HALF_UP);
        if (withheld.signum() < 0 || withheld.compareTo(deposit.getAmount()) > 0) {
            throw new IllegalArgumentException("O valor retido tem de estar entre 0 e a caução");
        }
        if (withheld.signum() > 0 && (reason == null || reason.isBlank())) {
            throw new IllegalArgumentException("Indica o motivo da retenção");
        }
        BigDecimal returned = deposit.getAmount().subtract(withheld);
        booking.setStatus(BookingStatus.COMPLETED);

        if (withheld.signum() == 0) {
            decide(deposit, ownerId, DepositStatus.RELEASED, BigDecimal.ZERO, null);
            auditService.record(ownerId, AuditAction.DEPOSIT_RETURNED_BY_OWNER, AuditService.BOOKING, bookingId, null,
                    Map.of("amount", deposit.getAmount().toPlainString()));
            notificationService.depositReturnedByOwner(booking, deposit.getAmount());
        } else {
            decide(deposit, ownerId, DepositStatus.WITHHELD, withheld, reason.strip());
            auditService.record(ownerId, AuditAction.DEPOSIT_WITHHELD_BY_OWNER, AuditService.BOOKING, bookingId,
                    reason.strip(), Map.of("amount", deposit.getAmount().toPlainString(),
                            "withheld", withheld.toPlainString(), "returned", returned.toPlainString()));
            notificationService.depositWithheldByOwner(booking, withheld, returned, reason.strip());
        }
        return DepositResponse.from(deposit);
    }

    // Modo direct: quando o dono decidiu a caução, se foi há menos de 7 dias (o arrendatário ainda pode contestar)
    @Transactional(readOnly = true)
    public java.util.Optional<OffsetDateTime> contestableSince(UUID bookingId) {
        if (!paymentProperties.direct()) return java.util.Optional.empty();
        return depositRepository.findByBookingId(bookingId)
                .filter(d -> d.getStatus() != DepositStatus.HELD && d.getDecidedAt() != null)
                .filter(d -> d.getDecidedBy() != null
                        && d.getDecidedBy().getId().equals(d.getBooking().getOwner().getId()))
                .map(Deposit::getDecidedAt)
                .filter(at -> at.isAfter(OffsetDateTime.now().minus(CONTEST_WINDOW)));
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
        // modo direct: depois da devolução é o dono que decide; a equipa só entra quando há um problema
        List<BookingStatus> statuses = paymentProperties.direct() ? List.of(BookingStatus.DISPUTED) : DECIDABLE;
        return depositRepository.findQueue(DepositStatus.HELD, statuses, pageable).map(DepositResponse::from);
    }

    @Transactional(readOnly = true)
    public boolean hasHeldDeposit(UUID bookingId) {
        return depositRepository.findByBookingId(bookingId).map(d -> d.getStatus() == DepositStatus.HELD).orElse(false);
    }

    public DepositResponse release(UUID adminId, UUID bookingId, String reason) {
        Deposit deposit = lockHeld(bookingId);
        Booking booking = deposit.getBooking();
        assertDecidable(booking);

        if (!paymentProperties.direct()) ledgerService.completeBooking(bookingId);
        decide(deposit, adminId, DepositStatus.RELEASED, BigDecimal.ZERO, reason);
        booking.setStatus(BookingStatus.COMPLETED);

        auditService.record(adminId, AuditAction.DEPOSIT_RELEASED, AuditService.BOOKING, bookingId, reason,
                Map.of("amount", deposit.getAmount().toPlainString()));
        if (paymentProperties.direct()) {
            notificationService.depositDecidedByTeam(booking, BigDecimal.ZERO, deposit.getAmount(), reason);
        } else {
            notificationService.depositReleased(booking, deposit.getAmount());
        }
        return DepositResponse.from(deposit);
    }

    public DepositResponse withhold(UUID adminId, UUID bookingId, BigDecimal amount, String reason) {
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Indica o motivo da retenção");
        Deposit deposit = lockHeld(bookingId);
        Booking booking = deposit.getBooking();
        assertDecidable(booking);
        BigDecimal withheld = amount.setScale(2, java.math.RoundingMode.HALF_UP);
        if (withheld.compareTo(deposit.getAmount()) > 0) {
            throw new IllegalArgumentException("Não podes reter mais do que a caução");
        }

        if (!paymentProperties.direct()) ledgerService.withholdDeposit(bookingId, withheld);
        decide(deposit, adminId, DepositStatus.WITHHELD, withheld, reason.strip());
        booking.setStatus(BookingStatus.COMPLETED);

        BigDecimal returned = deposit.getAmount().subtract(withheld);
        auditService.record(adminId, AuditAction.DEPOSIT_WITHHELD, AuditService.BOOKING, bookingId, reason,
                Map.of("amount", deposit.getAmount().toPlainString(), "withheld", withheld.toPlainString(),
                        "returned", returned.toPlainString()));
        if (paymentProperties.direct()) {
            notificationService.depositDecidedByTeam(booking, withheld, returned, reason.strip());
        } else {
            notificationService.depositWithheld(booking, withheld, returned, reason.strip());
        }
        return DepositResponse.from(deposit);
    }

    private void decide(Deposit deposit, UUID deciderId, DepositStatus status, BigDecimal withheld, String reason) {
        deposit.setStatus(status);
        deposit.setWithheldAmount(withheld);
        deposit.setReason(reason == null || reason.isBlank() ? null : reason.strip());
        deposit.setDecidedBy(profileRepository.getReferenceById(deciderId));
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
