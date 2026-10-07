package com.beeznoo.api.booking.service;

import com.beeznoo.api.booking.dto.BookingDtos.*;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.item.entity.Item;
import com.beeznoo.api.item.entity.ItemStatus;
import com.beeznoo.api.item.repository.ItemRepository;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class BookingService {

    // Reservas que bloqueiam as datas do item
    private static final List<BookingStatus> BLOCKING_STATUSES =
            List.of(BookingStatus.ACCEPTED, BookingStatus.ACTIVE);

    private final BookingRepository bookingRepository;
    private final ItemRepository itemRepository;
    private final ProfileRepository profileRepository;

    public BookingService(BookingRepository bookingRepository, ItemRepository itemRepository, ProfileRepository profileRepository) {
        this.bookingRepository = bookingRepository;
        this.itemRepository = itemRepository;
        this.profileRepository = profileRepository;
    }

    public BookingResponse create(UUID renterId, CreateBookingRequest request) {
        Profile renter = findProfile(renterId);

        if (renter.getRole() != UserRole.RENTER && renter.getRole() != UserRole.BOTH) {
            throw new AccessDeniedException("Apenas RENTER ou BOTH podem criar reservas");
        }

        if (!request.endDate().isAfter(request.startDate())) {
            throw new IllegalArgumentException("A data de fim tem de ser posterior à data de início");
        }

        Item item = itemRepository.findActiveById(request.itemId())
                .orElseThrow(() -> new IllegalArgumentException("Item não encontrado"));

        if (item.getStatus() != ItemStatus.ACTIVE) {
            throw new IllegalStateException("O item não está disponível para reserva");
        }

        if (item.getOwner().getId().equals(renterId)) {
            throw new IllegalArgumentException("Não é possível reservar o próprio item");
        }

        assertNoOverlap(item, request);

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
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getById(UUID requesterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        if (!isRenter(requesterId, booking) && !isOwner(requesterId, booking)) {
            throw new AccessDeniedException("Sem permissão para ver esta reserva");
        }
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> listAsRenter(UUID renterId, Pageable pageable) {
        return bookingRepository.findByRenterId(renterId, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> listAsOwner(UUID ownerId, Pageable pageable) {
        return bookingRepository.findByOwnerId(ownerId, pageable).map(this::toResponse);
    }

    public BookingResponse accept(UUID requesterId, UUID bookingId, BookingActionRequest request) {
        Booking booking = findBooking(bookingId);
        assertOwner(requesterId, booking);
        assertStatus(booking, BookingStatus.PENDING_OWNER);

        // Outra reserva pode ter sido aceite entretanto para as mesmas datas
        if (bookingRepository.existsOverlapping(booking.getItem().getId(),
                booking.getStartDate(), booking.getEndDate(), BLOCKING_STATUSES)) {
            throw new IllegalStateException("O item já tem uma reserva confirmada para estas datas");
        }

        booking.setStatus(BookingStatus.ACCEPTED);
        if (request != null) booking.setOwnerNote(request.ownerNote());
        return toResponse(booking);
    }

    // Dono recusa/cancela ou arrendatário cancela — decide pela parte que faz o pedido
    public BookingResponse cancel(UUID requesterId, UUID bookingId, BookingActionRequest request) {
        Booking booking = findBooking(bookingId);

        if (isOwner(requesterId, booking)) {
            assertStatus(booking, BookingStatus.PENDING_OWNER, BookingStatus.ACCEPTED);
            booking.setStatus(BookingStatus.CANCELLED_OWNER);
            if (request != null) booking.setOwnerNote(request.ownerNote());
        } else if (isRenter(requesterId, booking)) {
            // Cancelamento após ACCEPTED é uma história futura
            assertStatus(booking, BookingStatus.PENDING_OWNER);
            booking.setStatus(BookingStatus.CANCELLED_RENTER);
        } else {
            throw new AccessDeniedException("Sem permissão para cancelar esta reserva");
        }

        return toResponse(booking);
    }

    // Interno/admin — sem integração Multicaixa por agora
    public BookingResponse confirmPayment(UUID requesterId, UUID bookingId) {
        assertAdmin(requesterId);
        Booking booking = findBooking(bookingId);
        assertStatus(booking, BookingStatus.ACCEPTED);
        booking.setStatus(BookingStatus.ACTIVE);
        return toResponse(booking);
    }

    // Interno/admin
    public BookingResponse complete(UUID requesterId, UUID bookingId) {
        assertAdmin(requesterId);
        Booking booking = findBooking(bookingId);
        assertStatus(booking, BookingStatus.ACTIVE);
        booking.setStatus(BookingStatus.COMPLETED);
        return toResponse(booking);
    }

    public BookingResponse dispute(UUID requesterId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        if (!isRenter(requesterId, booking) && !isOwner(requesterId, booking)) {
            throw new AccessDeniedException("Sem permissão para abrir disputa nesta reserva");
        }
        assertStatus(booking, BookingStatus.ACTIVE);
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

    private Booking findBooking(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }

    private BookingResponse toResponse(Booking booking) {
        Item item = booking.getItem();
        String cover = item.getPhotos().isEmpty() ? null : item.getPhotos().get(0).getPhotoUrl();
        return new BookingResponse(
                booking.getId(),
                item.getId(),
                item.getTitle(),
                cover,
                booking.getRenter().getId(),
                booking.getRenter().getFullName(),
                booking.getOwner().getId(),
                booking.getOwner().getFullName(),
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
