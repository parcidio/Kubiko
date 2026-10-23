package com.beeznoo.api.claim.service;

import com.beeznoo.api.audit.entity.AuditAction;
import com.beeznoo.api.audit.service.AuditService;
import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.booking.entity.BookingStatus;
import com.beeznoo.api.booking.repository.BookingRepository;
import com.beeznoo.api.claim.dto.IncidentDtos.IncidentPhotoResponse;
import com.beeznoo.api.claim.dto.IncidentDtos.IncidentResponse;
import com.beeznoo.api.claim.entity.IncidentPhoto;
import com.beeznoo.api.claim.entity.IncidentReport;
import com.beeznoo.api.claim.entity.IncidentStatus;
import com.beeznoo.api.claim.entity.IncidentType;
import com.beeznoo.api.claim.repository.IncidentReportRepository;
import com.beeznoo.api.common.storage.StorageService;
import com.beeznoo.api.common.storage.StorageTransactions;
import com.beeznoo.api.common.storage.UploadedFiles;
import com.beeznoo.api.common.storage.UploadedFiles.ValidFile;
import com.beeznoo.api.notification.service.NotificationService;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reportar problema (SPEC §7). Resolução 100% manual: a equipa fecha o caso com uma nota e decide a caução
 * à parte (DepositService). Ver claude/decisoes-produto.md (2026-10-23).
 */
@Slf4j
@Service
@Transactional
public class IncidentService {

    static final int MAX_PHOTOS = 6;
    static final Duration PHOTO_URL_TTL = Duration.ofMinutes(10);
    // Reservas em que se pode reportar: paga e ainda sem caução decidida
    static final List<BookingStatus> REPORTABLE = List.of(
            BookingStatus.ACTIVE, BookingStatus.IN_PROGRESS, BookingStatus.RETURNED, BookingStatus.DISPUTED);

    private final IncidentReportRepository incidentRepository;
    private final BookingRepository bookingRepository;
    private final ProfileRepository profileRepository;
    private final StorageService storageService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public IncidentService(IncidentReportRepository incidentRepository, BookingRepository bookingRepository,
                           ProfileRepository profileRepository, StorageService storageService,
                           NotificationService notificationService, AuditService auditService) {
        this.incidentRepository = incidentRepository;
        this.bookingRepository = bookingRepository;
        this.profileRepository = profileRepository;
        this.storageService = storageService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    public IncidentResponse report(UUID reporterId, UUID bookingId, IncidentType type, String description,
                                   List<MultipartFile> photos) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
        Profile reporter = partyOf(reporterId, booking);
        if (!REPORTABLE.contains(booking.getStatus())) {
            throw new IllegalStateException("Só podes reportar um problema numa reserva paga e ainda não concluída");
        }
        if (type == null) throw new IllegalArgumentException("Escolhe o tipo de problema");
        if (description == null || description.isBlank()) throw new IllegalArgumentException("Descreve o que aconteceu");
        List<MultipartFile> files = photos == null ? List.of() : photos;
        if (files.size() > MAX_PHOTOS) throw new IllegalArgumentException("Máximo de " + MAX_PHOTOS + " fotos");

        List<ValidFile> valid = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            valid.add(UploadedFiles.validate(files.get(i), "A foto " + (i + 1), UploadedFiles.IMAGES));
        }

        IncidentReport incident = incidentRepository.save(IncidentReport.builder()
                .booking(booking)
                .reporter(reporter)
                .type(type)
                .description(description.strip())
                .build());

        List<String> uploaded = StorageTransactions.deleteOnRollback(storageService);
        int position = 0;
        for (ValidFile file : valid) {
            String key = storageService.upload("incidents/" + bookingId + "/" + incident.getId(),
                    UUID.randomUUID() + "." + file.extension(), file.content(), file.contentType());
            uploaded.add(key);
            incident.getPhotos().add(IncidentPhoto.builder()
                    .incident(incident)
                    .storageKey(key)
                    .contentType(file.contentType())
                    .sizeBytes(file.content().length)
                    .position(position++)
                    .build());
        }
        incidentRepository.flush();

        booking.setStatus(BookingStatus.DISPUTED);
        notificationService.incidentReported(booking, reporter, type.label);
        log.info("Problema {} ({}) reportado na reserva {}", incident.getId(), type, bookingId);
        return toResponse(incident);
    }

    // Partes da reserva e admin
    @Transactional(readOnly = true)
    public List<IncidentResponse> listForBooking(UUID requesterId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Reserva não encontrada"));
        if (!isParty(requesterId, booking) && !isAdmin(requesterId)) {
            throw new AccessDeniedException("Sem acesso a esta reserva");
        }
        return incidentRepository.findByBookingIdOrderByCreatedAtAsc(bookingId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<IncidentResponse> queue(Pageable pageable) {
        return incidentRepository.findByStatusOrderByCreatedAtAsc(IncidentStatus.OPEN, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public IncidentResponse detail(UUID incidentId) {
        return toResponse(find(incidentId));
    }

    // Fecha o caso. A caução decide-se em /admin/deposits (a reserva continua DISPUTED até lá).
    public IncidentResponse resolve(UUID adminId, UUID incidentId, String note) {
        if (note == null || note.isBlank()) throw new IllegalArgumentException("Indica como foi resolvido");
        IncidentReport incident = find(incidentId);
        if (incident.getStatus() == IncidentStatus.RESOLVED) throw new IllegalStateException("Este problema já foi resolvido");

        incident.setStatus(IncidentStatus.RESOLVED);
        incident.setResolutionNote(note.strip());
        incident.setResolvedBy(profileRepository.getReferenceById(adminId));
        incident.setResolvedAt(OffsetDateTime.now());
        auditService.record(adminId, AuditAction.INCIDENT_RESOLVED, AuditService.INCIDENT, incidentId, note,
                Map.of("bookingId", incident.getBooking().getId().toString(), "type", incident.getType().name()));
        return toResponse(incident);
    }

    private IncidentResponse toResponse(IncidentReport i) {
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(PHOTO_URL_TTL);
        List<IncidentPhotoResponse> photos = i.getPhotos().stream()
                .map(p -> new IncidentPhotoResponse(p.getId(),
                        storageService.generateSignedUrl(p.getStorageKey(), PHOTO_URL_TTL), p.getPosition()))
                .toList();
        Booking b = i.getBooking();
        return new IncidentResponse(
                i.getId(), b.getId(), b.getItem().getTitle(), b.getStatus().name(),
                i.getReporter().getId(), i.getReporter().getFullName(),
                i.getType().name(), i.getDescription(), i.getStatus().name(),
                i.getResolutionNote(), i.getResolvedAt(), photos, expiresAt, i.getCreatedAt());
    }

    private IncidentReport find(UUID incidentId) {
        return incidentRepository.findById(incidentId)
                .orElseThrow(() -> new IllegalArgumentException("Problema não encontrado"));
    }

    private static Profile partyOf(UUID profileId, Booking booking) {
        if (booking.getRenter().getId().equals(profileId)) return booking.getRenter();
        if (booking.getOwner().getId().equals(profileId)) return booking.getOwner();
        throw new AccessDeniedException("Só o dono e o arrendatário desta reserva");
    }

    private static boolean isParty(UUID profileId, Booking booking) {
        return booking.getRenter().getId().equals(profileId) || booking.getOwner().getId().equals(profileId);
    }

    private boolean isAdmin(UUID profileId) {
        return profileRepository.findById(profileId).map(p -> p.getRole() == UserRole.ADMIN).orElse(false);
    }
}
