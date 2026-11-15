package com.beeznoo.api.booking.service;

import com.beeznoo.api.booking.dto.BookingDtos.*;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.common.util.Formats;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.contract.service.ContractService;
import com.beeznoo.api.deposit.service.DepositService;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.item.service.AvailabilityService;
import com.beeznoo.api.item.service.PhotoUrls;
import com.beeznoo.api.kyc.service.KycService;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.transaction.service.LedgerService;
import com.beeznoo.api.transaction.entity.DirectChannel;
import com.beeznoo.api.transaction.service.PaymentService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@lombok.extern.slf4j.Slf4j
@Service
@Transactional
public class BookingService {

    // Reservas que bloqueiam as datas do item
    private static final List<BookingStatus> BLOCKING_STATUSES = BookingStatus.OCCUPYING;

    private final BookingRepository bookingRepository;
    private final ItemRepository itemRepository;
    private final ProfileRepository profileRepository;
    private final LedgerService ledgerService;
    private final PaymentService paymentService;
    private final KycService kycService;
    private final NotificationService notificationService;
    private final PhotoUrls photoUrls;
    private final ContractService contractService;
    private final DepositService depositService;
    private final AuditService auditService;
    private final AvailabilityService availabilityService;
    private final Duration requestTtl;

    public BookingService(BookingRepository bookingRepository, ItemRepository itemRepository,
                          ProfileRepository profileRepository, LedgerService ledgerService,
                          PaymentService paymentService, KycService kycService,
                          NotificationService notificationService, PhotoUrls photoUrls,
                          ContractService contractService, DepositService depositService,
                          AuditService auditService, AvailabilityService availabilityService,
                          @org.springframework.beans.factory.annotation.Value("${app.bookings.request-ttl:24h}") Duration requestTtl) {
        this.requestTtl = requestTtl;
        this.availabilityService = availabilityService;
        this.bookingRepository = bookingRepository;
        this.itemRepository = itemRepository;
        this.profileRepository = profileRepository;
        this.ledgerService = ledgerService;
        this.paymentService = paymentService;
        this.kycService = kycService;
        this.notificationService = notificationService;
        this.photoUrls = photoUrls;
        this.contractService = contractService;
        this.depositService = depositService;
        this.auditService = auditService;
    }

    public BookingResponse create(UUID renterId, CreateBookingRequest request) {
        Profile renter = findProfile(renterId);

        if (renter.getRole() != UserRole.RENTER && renter.getRole() != UserRole.BOTH) {
            throw new AccessDeniedException("Apenas RENTER ou BOTH podem criar reservas");
        }
        kycService.assertCanTransact(renterId);
        if (renter.isSuspended()) {
            throw new AccessDeniedException("A tua conta está suspensa. Fala com a equipa Beeznoo.");
        }

        if (!request.endDate().isAfter(request.startDate())) {
            throw new IllegalArgumentException("A data de fim tem de ser posterior à data de início");
        }

        Item item = itemRepository.findActiveById(request.itemId())
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));

        // item suspenso pela equipa ou dono com a conta suspensa: indisponível (sem dizer porquê)
        if (item.getStatus() != ItemStatus.ACTIVE || item.getOwner().isSuspended()) {
            throw new IllegalStateException("O item não está disponível para reserva");
        }

        if (item.getOwner().getId().equals(renterId)) {
            throw new IllegalArgumentException("Não é possível reservar o próprio item");
        }

        // Lock no item: um bloqueio de datas do dono não se cruza com este pedido
        itemRepository.findByIdForUpdate(item.getId());
        assertNoOverlap(item, request);
        if (availabilityService.isBlocked(item.getId(), request.startDate(), request.endDate())) {
            throw new IllegalStateException("O dono bloqueou algumas destas datas. Escolhe outras");
        }

        long days = ChronoUnit.DAYS.between(request.startDate(), request.endDate());

        Booking booking = Booking.builder()
                .item(item)
                .renter(renter)
                .owner(item.getOwner())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .totalPrice(item.getPricePerDay().multiply(BigDecimal.valueOf(days)))
                .depositAmount(item.getDepositAmount())
                .renterMessage(request.renterMessage())
                .build();

        bookingRepository.save(booking);
        notificationService.bookingReceived(booking);
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getById(UUID requesterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        // admin: detalhe para as filas e a auditoria (dados da reserva, sem documentos — esses são auditados à parte)
        if (!isRenter(requesterId, booking) && !isOwner(requesterId, booking)
                && findProfile(requesterId).getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Sem permissão para ver esta reserva");
        }
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> listAsRenter(UUID renterId, Pageable pageable) {
        return withVerified(bookingRepository.findByRenterId(renterId, pageable));
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> listAsOwner(UUID ownerId, Pageable pageable) {
        return withVerified(bookingRepository.findByOwnerId(ownerId, pageable));
    }

    public BookingResponse accept(UUID requesterId, UUID bookingId, BookingActionRequest request) {
        // lock na reserva: o agendador de expiração não a muda a meio
        Booking booking = findBookingForUpdate(bookingId);
        assertOwner(requesterId, booking);
        if (booking.getStatus() == BookingStatus.EXPIRED) {
            throw new IllegalStateException("Este pedido expirou: passou o prazo de resposta");
        }
        assertStatus(booking, BookingStatus.PENDING_OWNER);
        // prazo vencido mas o agendador ainda não passou: recusar na mesma (expira na próxima volta)
        if (isOverdue(booking, OffsetDateTime.now())) {
            throw new IllegalStateException("Este pedido expirou: passou o prazo de resposta");
        }

        // Lock no item: dois "aceitar" ao mesmo tempo para datas sobrepostas ficam em série
        itemRepository.findByIdForUpdate(booking.getItem().getId());
        // Outra reserva pode ter sido aceite entretanto para as mesmas datas
        if (bookingRepository.existsOverlapping(booking.getItem().getId(),
                booking.getStartDate(), booking.getEndDate(), BLOCKING_STATUSES)) {
            throw new IllegalStateException("O item já tem uma reserva confirmada para estas datas");
        }
        // O dono pode ter bloqueado estas datas depois do pedido
        if (availabilityService.isBlocked(booking.getItem().getId(), booking.getStartDate(), booking.getEndDate())) {
            throw new IllegalStateException("Bloqueaste algumas destas datas. Remove o bloqueio para aceitar o pedido");
        }

        // Sem retenção aqui: o arrendatário paga depois por referência (decisoes-produto.md, 2026-10-16)
        booking.setStatus(BookingStatus.ACCEPTED);
        if (request != null) booking.setOwnerNote(request.ownerNote());
        contractService.generateOnAccept(booking);
        notificationService.bookingAccepted(booking, paymentService.directMode());
        return toResponse(booking);
    }

    // Dono recusa/cancela ou arrendatário cancela — decide pela parte que faz o pedido
    public BookingResponse cancel(UUID requesterId, UUID bookingId, BookingActionRequest request) {
        Booking booking = findBookingForUpdate(bookingId);

        if (isOwner(requesterId, booking)) {
            assertStatus(booking, BookingStatus.PENDING_OWNER, BookingStatus.ACCEPTED);
            boolean wasPending = booking.getStatus() == BookingStatus.PENDING_OWNER;
            booking.setStatus(BookingStatus.CANCELLED_OWNER);
            if (request != null) booking.setOwnerNote(request.ownerNote());
            // dono a cancelar um pedido por responder = recusar
            if (wasPending) notificationService.bookingRejected(booking);
            else notificationService.bookingCancelled(booking, booking.getOwner());
        } else if (isRenter(requesterId, booking)) {
            // Pode cancelar até pagar: em ACCEPTED ainda não pagou nada (decisoes-produto.md 2026-11-15)
            assertStatus(booking, BookingStatus.PENDING_OWNER, BookingStatus.ACCEPTED);
            booking.setStatus(BookingStatus.CANCELLED_RENTER);
            notificationService.bookingCancelled(booking, booking.getRenter());
        } else {
            throw new AccessDeniedException("Sem permissão para cancelar esta reserva");
        }

        paymentService.cancelOpen(bookingId);
        if (ledgerService.hasActiveHold(bookingId)) {
            ledgerService.releaseHold(bookingId);
        }

        return toResponse(booking);
    }

    // Interno/admin — validação manual de comprovativo (alternativa à referência)
    public BookingResponse confirmPayment(UUID requesterId, UUID bookingId) {
        return confirmPayment(requesterId, bookingId, null);
    }

    public BookingResponse confirmPayment(UUID requesterId, UUID bookingId, String reason) {
        return confirmPayment(requesterId, bookingId, reason, null);
    }

    // Modo direct (2026-11-15): o dono confirma que recebeu o pagamento na entrega
    public BookingResponse confirmPaymentReceived(UUID ownerId, UUID bookingId, DirectChannel channel) {
        Booking booking = findBookingForUpdate(bookingId);
        if (!isOwner(ownerId, booking)) {
            throw new AccessDeniedException("Só o dono pode confirmar que recebeu o pagamento");
        }
        assertStatus(booking, BookingStatus.ACCEPTED);
        var payment = paymentService.confirmDirect(ownerId, booking, channel);
        auditService.record(ownerId, AuditAction.PAYMENT_RECEIVED, AuditService.BOOKING, bookingId, null,
                Map.of("paymentId", payment.id().toString(), "channel", channel.name(),
                        "amount", payment.amount().toPlainString()));
        return toResponse(booking);
    }

    // Modo direct: o dono regista que devolveu a caução (toda ou com retenção) → COMPLETED
    public BookingResponse decideDepositAsOwner(UUID ownerId, UUID bookingId, java.math.BigDecimal withheld, String reason) {
        Booking booking = findBookingForUpdate(bookingId);
        if (!isOwner(ownerId, booking)) {
            throw new AccessDeniedException("Só o dono pode registar a devolução da caução");
        }
        depositService.decideAsOwner(ownerId, bookingId, withheld, reason);
        return toResponse(booking);
    }

    // channel: só no modo direct — o admin confirma em nome do dono (por exemplo, por telefone)
    public BookingResponse confirmPayment(UUID requesterId, UUID bookingId, String reason, DirectChannel channel) {
        assertAdmin(requesterId);
        Booking booking = findBookingForUpdate(bookingId);
        assertStatus(booking, BookingStatus.ACCEPTED);
        if (paymentService.directMode()) {
            if (reason == null || reason.isBlank()) {
                throw new IllegalArgumentException("Indica o motivo (por exemplo: o dono confirmou por telefone)");
            }
            paymentService.confirmDirect(requesterId, booking, channel);
            auditService.record(requesterId, AuditAction.PAYMENT_CONFIRMED_MANUALLY, AuditService.BOOKING, bookingId,
                    reason, Map.of("status", booking.getStatus().name(), "channel", channel.name()));
            return toResponse(booking);
        }
        // Validação manual (comprovativo): liquida no ledger e passa a ACTIVE
        paymentService.confirmManually(booking);
        auditService.record(requesterId, AuditAction.PAYMENT_CONFIRMED_MANUALLY, AuditService.BOOKING, bookingId,
                reason, Map.of("status", booking.getStatus().name()));
        return toResponse(booking);
    }

    // Interno/admin
    public BookingResponse complete(UUID requesterId, UUID bookingId) {
        return complete(requesterId, bookingId, null);
    }

    // Concluir = libertar a caução inteira (ver DepositService). Só depois da devolução ou de um problema.
    public BookingResponse complete(UUID requesterId, UUID bookingId, String reason) {
        assertAdmin(requesterId);
        Booking booking = findBooking(bookingId);
        assertStatus(booking, BookingStatus.RETURNED, BookingStatus.DISPUTED);
        if (depositService.hasHeldDeposit(bookingId)) {
            depositService.release(requesterId, bookingId, reason);
        } else {
            booking.setStatus(BookingStatus.COMPLETED);
            auditService.record(requesterId, AuditAction.BOOKING_COMPLETED, AuditService.BOOKING, bookingId,
                    reason, Map.of());
        }
        return toResponse(booking);
    }

    public BookingResponse dispute(UUID requesterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        if (!isRenter(requesterId, booking) && !isOwner(requesterId, booking)) {
            throw new AccessDeniedException("Sem permissão para abrir disputa nesta reserva");
        }
        assertStatus(booking, BookingStatus.ACTIVE, BookingStatus.IN_PROGRESS, BookingStatus.RETURNED);
        booking.setStatus(BookingStatus.DISPUTED);
        return toResponse(booking);
    }

    private void assertNoOverlap(Item item, CreateBookingRequest request) {
        if (bookingRepository.existsOverlapping(item.getId(),
                request.startDate(), request.endDate(), BLOCKING_STATUSES)) {
            throw new IllegalStateException("O item já está reservado para estas datas");
        }
    }

    private void assertStatus(Booking booking, BookingStatus... allowed) {
        for (BookingStatus status : allowed) {
            if (booking.getStatus() == status) return;
        }
        throw new IllegalStateException(
                "Transição inválida a partir do estado " + booking.getStatus());
    }

    private void assertOwner(UUID requesterId, Booking booking) {
        if (!isOwner(requesterId, booking)) {
            throw new AccessDeniedException("Apenas o dono do item pode executar esta ação");
        }
    }

    private void assertAdmin(UUID requesterId) {
        if (findProfile(requesterId).getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Apenas administradores podem executar esta ação");
        }
    }

    private boolean isOwner(UUID requesterId, Booking booking) {
        return booking.getOwner().getId().equals(requesterId);
    }

    private boolean isRenter(UUID requesterId, Booking booking) {
        return booking.getRenter().getId().equals(requesterId);
    }

    private Profile findProfile(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
    }

    // ─── Expiração de pedidos sem resposta (gap #11) ───────────────────────

    /** Prazo de resposta: pedido + TTL (24 h) ou o fim do dia de levantamento em Luanda, o que vier primeiro. */
    // Pedido sem resposta (24 h ou dia de levantamento) ou reserva aceite que nunca foi paga até ao dia de devolução
    // (ninguém apareceu ou ninguém confirmou o pagamento — decisoes-produto.md 2026-11-15)
    boolean isOverdue(Booking b, OffsetDateTime now) {
        LocalDate today = now.atZoneSameInstant(Formats.LUANDA).toLocalDate();
        if (b.getStatus() == BookingStatus.ACCEPTED) return b.getEndDate().isBefore(today);
        if (b.getStatus() != BookingStatus.PENDING_OWNER) return false;
        return !b.getCreatedAt().plus(requestTtl).isAfter(now) || b.getStartDate().isBefore(today);
    }

    @Transactional(readOnly = true)
    public List<UUID> findOverduePendingIds() {
        OffsetDateTime now = OffsetDateTime.now();
        return bookingRepository.findOverduePendingIds(now.minus(requestTtl),
                now.atZoneSameInstant(Formats.LUANDA).toLocalDate());
    }

    /** Chamado pelo BookingExpiryScheduler, uma transação por pedido. Volta a verificar com a linha bloqueada. */
    public void expire(UUID bookingId) {
        bookingRepository.findByIdForUpdate(bookingId)
                .filter(b -> isOverdue(b, OffsetDateTime.now()))
                .ifPresent(b -> {
                    boolean accepted = b.getStatus() == BookingStatus.ACCEPTED;
                    b.setStatus(BookingStatus.EXPIRED);
                    if (accepted) {
                        paymentService.cancelOpen(b.getId());
                        notificationService.acceptedBookingExpired(b);
                        log.info("Reserva {} aceite e nunca paga — expirada depois do dia de devolução", b.getId());
                    } else {
                        notificationService.bookingExpired(b);
                        log.info("Pedido {} expirado sem resposta do dono", b.getId());
                    }
                });
    }

    private Booking findBookingForUpdate(UUID bookingId) {
        return bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }

    private Booking findBooking(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }

    // Selo "Verificado" das duas partes para a página inteira, numa só consulta
    private Page<BookingResponse> withVerified(Page<Booking> page) {
        Set<UUID> parties = new HashSet<>();
        page.forEach(b -> {
            parties.add(b.getRenter().getId());
            parties.add(b.getOwner().getId());
        });
        Set<UUID> verified = kycService.verifiedAmong(parties);
        return page.map(b -> toResponse(b, verified));
    }

    private BookingResponse toResponse(Booking booking) {
        return toResponse(booking, kycService.verifiedAmong(
                List.of(booking.getRenter().getId(), booking.getOwner().getId())));
    }

    private BookingResponse toResponse(Booking booking, Set<UUID> verified) {
        Item item = booking.getItem();
        String cover = item.getPhotos().isEmpty() ? null : photoUrls.of(item.getPhotos().get(0));
        return new BookingResponse(
                booking.getId(),
                item.getId(),
                item.getTitle(),
                cover,
                booking.getRenter().getId(),
                booking.getRenter().getFullName(),
                verified.contains(booking.getRenter().getId()),
                booking.getOwner().getId(),
                booking.getOwner().getFullName(),
                verified.contains(booking.getOwner().getId()),
                booking.getStartDate(),
                booking.getEndDate(),
                booking.getTotalPrice(),
                booking.getDepositAmount(),
                booking.getStatus().name(),
                booking.getRenterMessage(),
                booking.getOwnerNote(),
                booking.getCreatedAt(),
                booking.getUpdatedAt()
        );
    }
}
