package com.beeznoo.api.handover.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.common.storage.StorageTransactions;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.common.storage.UploadedFiles.ValidFile;
import com.beeznoo.api.handover.dto.ChecklistDtos.ChecklistPhotoResponse;
import com.beeznoo.api.handover.dto.ChecklistDtos.ChecklistResponse;
import com.beeznoo.api.handover.entity.Checklist;
import com.beeznoo.api.handover.entity.ChecklistPhoto;
import com.beeznoo.api.handover.entity.ChecklistType;
import com.beeznoo.api.handover.repository.ChecklistRepository;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Checklists de entrega e devolução (SPEC §7). Uma das partes regista notas + fotos; a OUTRA confirma e a
 * reserva avança. Quem não concorda reporta um problema em vez de confirmar. Ver claude/decisoes-produto.md (2026-10-23).
 */
@Slf4j
@Service
@Transactional
public class ChecklistService {

    static final int MIN_PHOTOS = 2;
    static final int MAX_PHOTOS = 10;
    static final Duration PHOTO_URL_TTL = Duration.ofMinutes(10);

    private final ChecklistRepository checklistRepository;
    private final BookingRepository bookingRepository;
    private final ProfileRepository profileRepository;
    private final StorageService storageService;
    private final NotificationService notificationService;

    public ChecklistService(ChecklistRepository checklistRepository, BookingRepository bookingRepository,
                            ProfileRepository profileRepository, StorageService storageService,
                            NotificationService notificationService) {
        this.checklistRepository = checklistRepository;
        this.bookingRepository = bookingRepository;
        this.profileRepository = profileRepository;
        this.storageService = storageService;
        this.notificationService = notificationService;
    }

    public ChecklistResponse create(UUID profileId, UUID bookingId, ChecklistType type, String notes,
                                    List<MultipartFile> photos) {
        Booking booking = findBooking(bookingId);
        Profile author = assertParty(profileId, booking);
        requireStatus(booking, type == ChecklistType.DELIVERY ? BookingStatus.ACTIVE : BookingStatus.IN_PROGRESS);
        if (checklistRepository.findByBookingIdAndType(bookingId, type).isPresent()) {
            throw new IllegalStateException("Esta " + label(type) + " já foi registada");
        }
        if (notes == null || notes.isBlank()) {
            throw new IllegalArgumentException("Descreve o estado do equipamento");
        }
        if (notes.length() > 2000) throw new IllegalArgumentException("As notas podem ter no máximo 2000 caracteres");
        int count = photos == null ? 0 : photos.size();
        if (count < MIN_PHOTOS || count > MAX_PHOTOS) {
            throw new IllegalArgumentException("Envia entre " + MIN_PHOTOS + " e " + MAX_PHOTOS + " fotos do equipamento");
        }

        List<ValidFile> valid = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            valid.add(UploadedFiles.validate(photos.get(i), "A foto " + (i + 1), UploadedFiles.IMAGES));
        }

        Checklist checklist = checklistRepository.save(Checklist.builder()
                .booking(booking)
                .type(type)
                .createdBy(author)
                .notes(notes.strip())
                .build());

        List<String> uploaded = StorageTransactions.deleteOnRollback(storageService);
        String folder = "checklists/" + bookingId + "/" + type.name().toLowerCase();
        int position = 0;
        for (ValidFile file : valid) {
            String key = storageService.upload(folder, UUID.randomUUID() + "." + file.extension(),
                    file.content(), file.contentType());
            uploaded.add(key);
            checklist.getPhotos().add(ChecklistPhoto.builder()
                    .checklist(checklist)
                    .storageKey(key)
                    .contentType(file.contentType())
                    .sizeBytes(file.content().length)
                    .position(position++)
                    .build());
        }
        checklistRepository.flush();

        notificationService.checklistToConfirm(booking, type == ChecklistType.DELIVERY, otherParty(booking, author));
        log.info("Checklist {} ({}) registada na reserva {}", checklist.getId(), type, bookingId);
        return toResponse(checklist);
    }

    // A outra parte confirma — a reserva avança
    public ChecklistResponse confirm(UUID profileId, UUID bookingId, ChecklistType type) {
        Booking booking = findBooking(bookingId);
        Profile confirmer = assertParty(profileId, booking);
        Checklist checklist = checklistRepository.findByBookingIdAndType(bookingId, type)
                .orElseThrow(() -> new IllegalStateException("Ainda não há registo de " + label(type)));
        if (checklist.isConfirmed()) return toResponse(checklist);
        if (checklist.getCreatedBy().getId().equals(profileId)) {
            throw new IllegalStateException("A " + label(type) + " tem de ser confirmada pela outra parte");
        }

        checklist.setConfirmedBy(confirmer);
        checklist.setConfirmedAt(OffsetDateTime.now());
        if (type == ChecklistType.DELIVERY) {
            requireStatus(booking, BookingStatus.ACTIVE);
            booking.setStatus(BookingStatus.IN_PROGRESS);
            notificationService.bookingInProgress(booking);
        } else {
            requireStatus(booking, BookingStatus.IN_PROGRESS);
            booking.setStatus(BookingStatus.RETURNED);
            notificationService.bookingReturned(booking);
        }
        log.info("Checklist {} confirmada — reserva {} {}", checklist.getId(), bookingId, booking.getStatus());
        return toResponse(checklist);
    }

    // Partes da reserva e admin
    @Transactional(readOnly = true)
    public List<ChecklistResponse> list(UUID profileId, UUID bookingId) {
        Booking booking = findBooking(bookingId);
        boolean party = isParty(profileId, booking);
        if (!party && !isAdmin(profileId)) throw new AccessDeniedException("Sem acesso a esta reserva");
        return checklistRepository.findByBookingIdOrderByCreatedAtAsc(bookingId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ChecklistResponse toResponse(Checklist c) {
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(PHOTO_URL_TTL);
        List<ChecklistPhotoResponse> photos = c.getPhotos().stream()
                .map(p -> new ChecklistPhotoResponse(p.getId(),
                        storageService.generateSignedUrl(p.getStorageKey(), PHOTO_URL_TTL), p.getPosition()))
                .toList();
        return new ChecklistResponse(
                c.getId(),
                c.getBooking().getId(),
                c.getType().name(),
                c.getCreatedBy().getId(),
                c.getCreatedBy().getFullName(),
                c.getNotes(),
                photos,
                expiresAt,
                c.isConfirmed(),
                c.getConfirmedBy() == null ? null : c.getConfirmedBy().getId(),
                c.getConfirmedAt(),
                c.getCreatedAt()
        );
    }

    private Profile assertParty(UUID profileId, Booking booking) {
        if (!isParty(profileId, booking)) {
            throw new AccessDeniedException("Só o dono e o arrendatário desta reserva");
        }
        return booking.getRenter().getId().equals(profileId) ? booking.getRenter() : booking.getOwner();
    }

    private static boolean isParty(UUID profileId, Booking booking) {
        return booking.getRenter().getId().equals(profileId) || booking.getOwner().getId().equals(profileId);
    }

    private static Profile otherParty(Booking booking, Profile author) {
        return booking.getRenter().getId().equals(author.getId()) ? booking.getOwner() : booking.getRenter();
    }

    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId).map(p -> p.getRole() == UserRole.ADMIN).orElse(false);
    }

    private static void requireStatus(Booking booking, BookingStatus expected) {
        if (booking.getStatus() != expected) {
            throw new IllegalStateException("Transição inválida a partir do estado " + booking.getStatus());
        }
    }

    private static String label(ChecklistType type) {
        return type == ChecklistType.DELIVERY ? "entrega" : "devolução";
    }

    private Booking findBooking(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
    }
}
