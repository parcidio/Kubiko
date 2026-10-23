package com.beeznoo.api.transaction.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.transaction.dto.LedgerDtos.*;
import com.beeznoo.api.transaction.entity.Account;
import com.beeznoo.api.transaction.entity.EntryType;
import com.beeznoo.api.transaction.entity.LedgerEntry;
import com.beeznoo.api.transaction.entity.Payment;
import com.beeznoo.api.transaction.repository.AccountRepository;
import com.beeznoo.api.transaction.repository.LedgerEntryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final AccountRepository accountRepository;
    private final BookingRepository bookingRepository;
    private final AuditService auditService;

    public LedgerService(LedgerEntryRepository ledgerEntryRepository, AccountRepository accountRepository,
                         BookingRepository bookingRepository, AuditService auditService) {
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.accountRepository = accountRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
    }

    // ACCEPTED — retém total + caução no saldo do arrendatário
    public void holdForBooking(UUID bookingId) {
        hold(findBooking(bookingId), null);
    }

    private void hold(Booking booking, Payment payment) {
        UUID bookingId = booking.getId();
        assertNotRegistered(bookingId, EntryType.HOLD, "A reserva já tem valor retido");

        Account renter = lockByProfile(booking.getRenter().getId());
        BigDecimal deposit = depositOf(booking);

        // valida o total antes de mexer no saldo, para não deixar o hold a meio
        if (renter.getAvailableBalance().compareTo(booking.getTotalPrice().add(deposit)) < 0) {
            throw new IllegalStateException("Saldo disponível insuficiente para aceitar a reserva");
        }

        renter.holdAmount(booking.getTotalPrice());
        record(renter, booking, payment, EntryType.HOLD, booking.getTotalPrice(), "Valor retido para a reserva");

        if (hasDeposit(deposit)) {
            renter.holdAmount(deposit);
            record(renter, booking, payment, EntryType.DEPOSIT_HOLD, deposit, "Caução retida para a reserva");
        }
    }

    // CANCELLED_OWNER / CANCELLED_RENTER após hold — devolve tudo ao disponível
    public void releaseHold(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        assertRegistered(bookingId, EntryType.HOLD, "A reserva não tem valor retido");
        assertNotRegistered(bookingId, EntryType.PAYMENT_DEBIT, "A reserva já foi paga");
        assertNotRegistered(bookingId, EntryType.HOLD_RELEASE, "O valor retido já foi libertado");

        Account renter = lockByProfile(booking.getRenter().getId());
        BigDecimal deposit = depositOf(booking);

        renter.releaseHeld(booking.getTotalPrice());
        record(renter, booking, EntryType.HOLD_RELEASE, booking.getTotalPrice(), "Reserva cancelada — valor libertado");

        if (hasDeposit(deposit)) {
            renter.releaseHeld(deposit);
            record(renter, booking, EntryType.DEPOSIT_RETURN, deposit, "Reserva cancelada — caução devolvida");
        }
    }

    // ACTIVE — débito definitivo do arrendatário e crédito no dono; a caução continua retida
    public void confirmPayment(UUID bookingId) {
        confirm(findBooking(bookingId), null);
    }

    private void confirm(Booking booking, Payment payment) {
        UUID bookingId = booking.getId();
        assertRegistered(bookingId, EntryType.HOLD, "A reserva não tem valor retido");
        assertNotRegistered(bookingId, EntryType.PAYMENT_DEBIT, "O pagamento já foi confirmado");

        Account[] accounts = lockRenterAndOwner(booking);
        Account renter = accounts[0];
        Account owner = accounts[1];

        renter.withholdHeld(booking.getTotalPrice());
        record(renter, booking, payment, EntryType.PAYMENT_DEBIT, booking.getTotalPrice(), "Pagamento da reserva");

        owner.credit(booking.getTotalPrice());
        record(owner, booking, payment, EntryType.PAYMENT_CREDIT, booking.getTotalPrice(), "Recebimento da reserva");
    }

    // Pagamento por referência confirmado — liquida tudo numa transação:
    // TOPUP (valor recebido) → SERVICE_FEE → HOLD/DEPOSIT_HOLD → PAYMENT_DEBIT/CREDIT
    // Cada movimento fica ligado ao pagamento (ledger_entries.payment_id)
    public void settleReferencePayment(Payment payment) {
        Booking booking = payment.getBooking();
        UUID bookingId = booking.getId();
        BigDecimal amountPaid = payment.getAmount();
        BigDecimal serviceFee = payment.getServiceFee();
        assertNotRegistered(bookingId, EntryType.TOPUP, "O pagamento desta reserva já foi registado");

        BigDecimal expected = booking.getTotalPrice().add(depositOf(booking)).add(serviceFee);
        if (amountPaid.compareTo(expected) != 0) {
            throw new IllegalStateException("Montante pago não corresponde ao valor da reserva");
        }

        Account renter = lockByProfile(booking.getRenter().getId());
        renter.credit(amountPaid);
        record(renter, booking, payment, EntryType.TOPUP, amountPaid, "Pagamento por referência recebido");

        if (serviceFee.signum() > 0) {
            renter.debit(serviceFee);
            record(renter, booking, payment, EntryType.SERVICE_FEE, serviceFee, "Taxa de serviço Beeznoo");
        }

        hold(booking, payment);
        confirm(booking, payment);
    }

    // COMPLETED — devolve a caução ao arrendatário
    public void completeBooking(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        assertRegistered(bookingId, EntryType.PAYMENT_DEBIT, "A reserva ainda não foi paga");

        BigDecimal deposit = depositOf(booking);
        if (!hasDeposit(deposit)) return;

        assertDepositStillHeld(bookingId);

        Account renter = lockByProfile(booking.getRenter().getId());
        renter.releaseHeld(deposit);
        record(renter, booking, EntryType.DEPOSIT_RETURN, deposit, "Reserva concluída — caução devolvida");
    }

    // Retenção parcial ou total: withheld vai para o dono, o resto volta ao disponível do arrendatário
    public void withholdDeposit(UUID bookingId, BigDecimal withheld) {
        Booking booking = findBooking(bookingId);
        assertRegistered(bookingId, EntryType.PAYMENT_DEBIT, "A reserva ainda não foi paga");

        BigDecimal deposit = depositOf(booking);
        if (withheld.signum() <= 0 || withheld.compareTo(deposit) > 0) {
            throw new IllegalArgumentException("O valor retido tem de estar entre 1 Kz e a caução");
        }
        assertDepositStillHeld(bookingId);

        Account[] accounts = lockRenterAndOwner(booking);
        Account renter = accounts[0];
        Account owner = accounts[1];

        renter.withholdHeld(withheld);
        record(renter, booking, EntryType.DEPOSIT_FORFEIT, withheld, "Caução retida");
        owner.credit(withheld);
        record(owner, booking, EntryType.PAYMENT_CREDIT, withheld, "Caução recebida");

        BigDecimal remainder = deposit.subtract(withheld);
        if (remainder.signum() > 0) {
            renter.releaseHeld(remainder);
            record(renter, booking, EntryType.DEPOSIT_RETURN, remainder, "Parte da caução devolvida");
        }
    }

    // Disputa resolvida a favor do dono — caução transferida para o dono
    public void forfeitDeposit(UUID bookingId) {
        Booking booking = findBooking(bookingId);
        assertRegistered(bookingId, EntryType.PAYMENT_DEBIT, "A reserva ainda não foi paga");

        BigDecimal deposit = depositOf(booking);
        if (!hasDeposit(deposit)) {
            throw new IllegalStateException("A reserva não tem caução");
        }
        assertDepositStillHeld(bookingId);

        Account[] accounts = lockRenterAndOwner(booking);
        Account renter = accounts[0];
        Account owner = accounts[1];

        renter.withholdHeld(deposit);
        record(renter, booking, EntryType.DEPOSIT_FORFEIT, deposit, "Caução retida por disputa");

        owner.credit(deposit);
        record(owner, booking, EntryType.PAYMENT_CREDIT, deposit, "Caução recebida por disputa");
    }

    // true se a reserva tem valor retido ainda não libertado nem pago
    @Transactional(readOnly = true)
    public boolean hasActiveHold(UUID bookingId) {
        return ledgerEntryRepository.existsByBookingIdAndType(bookingId, EntryType.HOLD)
                && !ledgerEntryRepository.existsByBookingIdAndType(bookingId, EntryType.HOLD_RELEASE)
                && !ledgerEntryRepository.existsByBookingIdAndType(bookingId, EntryType.PAYMENT_DEBIT);
    }

    // Ajuste manual (admin) — positivo credita, negativo debita
    public AccountResponse adjust(UUID adminId, UUID accountId, AdjustmentRequest request) {
        if (request.amount().signum() == 0) {
            throw new IllegalArgumentException("O valor do ajuste não pode ser zero");
        }

        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Conta não encontrada"));

        BigDecimal amount = request.amount().abs();
        if (request.amount().signum() > 0) {
            account.credit(amount);
        } else {
            account.debit(amount);
        }
        record(account, null, EntryType.ADJUSTMENT, amount, request.description());
        auditService.record(adminId, AuditAction.BALANCE_ADJUSTED, AuditService.ACCOUNT, accountId,
                request.description(), Map.of("amount", request.amount().toPlainString()));

        return toAccountResponse(account);
    }

    @Transactional(readOnly = true)
    public AccountResponse getMyAccount(UUID profileId) {
        return toAccountResponse(findByProfile(profileId));
    }

    @Transactional(readOnly = true)
    public Page<LedgerEntryResponse> getMyStatement(UUID profileId, Pageable pageable) {
        return getStatement(findByProfile(profileId).getId(), pageable);
    }

    @Transactional(readOnly = true)
    public Page<LedgerEntryResponse> getStatement(UUID accountId, Pageable pageable) {
        return ledgerEntryRepository.findByAccountIdOrderByCreatedAtDesc(accountId, pageable)
                .map(this::toEntryResponse);
    }

    private void record(Account account, Booking booking, EntryType type, BigDecimal amount, String description) {
        record(account, booking, null, type, amount, description);
    }

    private void record(Account account, Booking booking, Payment payment, EntryType type, BigDecimal amount,
                        String description) {
        ledgerEntryRepository.save(LedgerEntry.builder()
                .account(account)
                .booking(booking)
                .payment(payment)
                .type(type)
                .amount(amount)
                .balanceAfter(account.getAvailableBalance())
                .description(description)
                .build());
    }

    // Bloqueia sempre pela mesma ordem (id do perfil) para evitar deadlocks entre transacções concorrentes
    private Account[] lockRenterAndOwner(Booking booking) {
        UUID renterId = booking.getRenter().getId();
        UUID ownerId = booking.getOwner().getId();
        if (renterId.compareTo(ownerId) < 0) {
            Account renter = lockByProfile(renterId);
            return new Account[]{renter, lockByProfile(ownerId)};
        }
        Account owner = lockByProfile(ownerId);
        return new Account[]{lockByProfile(renterId), owner};
    }

    private Account lockByProfile(UUID profileId) {
        return accountRepository.findByProfileIdForUpdate(profileId)
                .orElseThrow(() -> new IllegalStateException("Conta não encontrada para o perfil"));
    }

    private Account findByProfile(UUID profileId) {
        return accountRepository.findByProfileId(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Conta não encontrada"));
    }

    private Booking findBooking(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }

    private void assertDepositStillHeld(UUID bookingId) {
        assertRegistered(bookingId, EntryType.DEPOSIT_HOLD, "A reserva não tem caução retida");
        assertNotRegistered(bookingId, EntryType.DEPOSIT_RETURN, "A caução já foi devolvida");
        assertNotRegistered(bookingId, EntryType.DEPOSIT_FORFEIT, "A caução já foi retida");
    }

    private void assertRegistered(UUID bookingId, EntryType type, String message) {
        if (!ledgerEntryRepository.existsByBookingIdAndType(bookingId, type)) {
            throw new IllegalStateException(message);
        }
    }

    private void assertNotRegistered(UUID bookingId, EntryType type, String message) {
        if (ledgerEntryRepository.existsByBookingIdAndType(bookingId, type)) {
            throw new IllegalStateException(message);
        }
    }

    private BigDecimal depositOf(Booking booking) {
        return booking.getDepositAmount() == null ? BigDecimal.ZERO : booking.getDepositAmount();
    }

    private boolean hasDeposit(BigDecimal deposit) {
        return deposit.signum() > 0;
    }

    private AccountResponse toAccountResponse(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getAvailableBalance(),
                account.getHeldBalance(),
                account.getCurrency(),
                account.getUpdatedAt()
        );
    }

    private LedgerEntryResponse toEntryResponse(LedgerEntry entry) {
        return new LedgerEntryResponse(
                entry.getId(),
                entry.getType().name(),
                entry.getAmount(),
                entry.getBalanceAfter(),
                entry.getDescription(),
                entry.getCreatedAt()
        );
    }
}
