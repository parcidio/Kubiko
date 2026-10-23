package com.beeznoo.api.notification.service;

import com.beeznoo.api.booking.entity.Booking;
import com.beeznoo.api.kyc.entity.KycVerification;
import com.beeznoo.api.notification.dto.NotificationDtos.NotificationResponse;
import com.beeznoo.api.notification.email.EmailTemplateRenderer;
import com.beeznoo.api.notification.email.ResendEmailSender;
import com.beeznoo.api.notification.entity.EmailStatus;
import com.beeznoo.api.notification.entity.Notification;
import com.beeznoo.api.notification.entity.NotificationType;
import com.beeznoo.api.notification.repository.NotificationRepository;
import com.beeznoo.api.profile.entity.AccountType;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.entity.UserRole;
import com.beeznoo.api.profile.repository.ProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Notificações na app (+ email depois do commit). Chamado pelos serviços de reserva, pagamento e KYC,
 * dentro da transação deles: se a operação fizer rollback, a notificação também não existe.
 * Ver claude/decisoes-produto.md (2026-10-23). Copy em PT-PT, "tu", sem dados de BI/NIF.
 */
@Service
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ProfileRepository profileRepository;
    private final EmailTemplateRenderer renderer;
    private final ResendEmailSender sender;
    private final ApplicationEventPublisher events;
    private final String frontendUrl;

    public NotificationService(NotificationRepository notificationRepository, ProfileRepository profileRepository,
                               EmailTemplateRenderer renderer, ResendEmailSender sender,
                               ApplicationEventPublisher events,
                               @Value("${app.frontend-url}") String frontendUrl) {
        this.notificationRepository = notificationRepository;
        this.profileRepository = profileRepository;
        this.renderer = renderer;
        this.sender = sender;
        this.events = events;
        this.frontendUrl = frontendUrl;
    }

    // ── Reservas ──────────────────────────────────────────────────────────

    public void bookingReceived(Booking b) {
        String item = b.getItem().getTitle();
        notify(b.getOwner(), NotificationType.BOOKING_RECEIVED, b,
                "Novo pedido: " + item,
                List.of(b.getRenter().getFullName() + " quer alugar de " + period(b) + ", por " + kz(b.getTotalPrice()) + ".",
                        "Responde o quanto antes: o pedido fica à tua espera."),
                "Ver pedido", "/pedidos");
    }

    public void bookingAccepted(Booking b) {
        notify(b.getRenter(), NotificationType.BOOKING_ACCEPTED, b,
                b.getItem().getTitle() + ": pedido aceite",
                List.of(b.getOwner().getFullName() + " aceitou o teu pedido para " + period(b) + ".",
                        "Gera a referência e paga para confirmar a reserva."),
                "Pagar reserva", "/reservas/" + b.getId() + "/pagar");
    }

    public void bookingRejected(Booking b) {
        List<String> lines = new ArrayList<>();
        lines.add(b.getOwner().getFullName() + " não pode aceitar o teu pedido para " + period(b) + ". Não pagaste nada.");
        if (b.getOwnerNote() != null && !b.getOwnerNote().isBlank()) {
            lines.add("Mensagem do dono: " + b.getOwnerNote().strip());
        }
        notify(b.getRenter(), NotificationType.BOOKING_REJECTED, b,
                b.getItem().getTitle() + ": pedido recusado", lines,
                "Explorar equipamento", "/explorar");
    }

    // cancelledBy é quem cancelou; avisa a outra parte
    public void bookingCancelled(Booking b, Profile cancelledBy) {
        boolean byOwner = cancelledBy.getId().equals(b.getOwner().getId());
        Profile recipient = byOwner ? b.getRenter() : b.getOwner();
        notify(recipient, NotificationType.BOOKING_CANCELLED, b,
                b.getItem().getTitle() + ": reserva cancelada",
                List.of(cancelledBy.getFullName() + " cancelou a reserva de " + period(b) + "."),
                byOwner ? "Ver reserva" : "Ver pedidos",
                byOwner ? "/reservas/" + b.getId() : "/pedidos");
    }

    // ── Pagamentos ────────────────────────────────────────────────────────

    public void paymentConfirmed(Booking b, BigDecimal amountPaid) {
        String item = b.getItem().getTitle();
        notify(b.getRenter(), NotificationType.PAYMENT_CONFIRMED, b,
                item + ": pagamento confirmado",
                List.of("Recebemos " + kz(amountPaid) + ". A reserva de " + period(b) + " está confirmada.",
                        "Combina a entrega com " + b.getOwner().getFullName() + "."),
                "Ver reserva", "/reservas/" + b.getId());
        notify(b.getOwner(), NotificationType.PAYMENT_CONFIRMED, b,
                item + ": reserva paga",
                List.of(b.getRenter().getFullName() + " pagou a reserva de " + period(b) + ".",
                        "Prepara o equipamento para a entrega."),
                "Ver pedidos", "/pedidos");
    }

    // "Já paguei" sem confirmação do gateway: a equipa valida à mão. Uma vez por reserva.
    public void paymentAwaitingValidation(Booking b, BigDecimal amount) {
        if (notificationRepository.existsByTypeAndBookingId(NotificationType.PAYMENT_AWAITING_VALIDATION, b.getId())) {
            return;
        }
        for (Profile admin : profileRepository.findByRole(UserRole.ADMIN)) {
            notify(admin, NotificationType.PAYMENT_AWAITING_VALIDATION, b,
                    "Pagamento a validar: " + b.getItem().getTitle(),
                    List.of(b.getRenter().getFullName() + " diz que já pagou " + kz(amount)
                            + " (reserva de " + period(b) + ").", "Confirma o pagamento antes de o validar."),
                    "Abrir pagamentos", "/admin/pagamentos");
        }
    }

    // ── KYC ───────────────────────────────────────────────────────────────

    public void kycSubmitted(KycVerification k) {
        String kind = k.getAccountType() == AccountType.BUSINESS ? "empresa" : "particular";
        for (Profile admin : profileRepository.findByRole(UserRole.ADMIN)) {
            notify(admin, NotificationType.KYC_SUBMITTED, null,
                    "Nova verificação de identidade",
                    List.of(k.getProfile().getFullName() + " enviou documentos (" + kind + ")."),
                    "Abrir verificações", "/admin/verificacoes");
        }
    }

    public void kycApproved(Profile p) {
        notify(p, NotificationType.KYC_APPROVED, null,
                "Identidade verificada",
                List.of("Já podes pedir reservas e publicar equipamento."),
                "Explorar equipamento", "/explorar");
    }

    public void kycRejected(Profile p, String reason) {
        notify(p, NotificationType.KYC_REJECTED, null,
                "Verificação recusada",
                List.of("Motivo: " + reason, "Podes enviar novos documentos quando quiseres."),
                "Enviar documentos", "/verificacao");
    }

    public void kycInfoRequested(Profile p, String note) {
        notify(p, NotificationType.KYC_INFO_REQUESTED, null,
                "Precisamos de mais informação",
                List.of(note, "Envia os documentos outra vez para continuarmos a verificação."),
                "Enviar documentos", "/verificacao");
    }

    // ── Histórico ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<NotificationResponse> listMine(UUID profileId) {
        return notificationRepository.findTop50ByProfileIdOrderByCreatedAtDesc(profileId).stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long countUnread(UUID profileId) {
        return notificationRepository.countByProfileIdAndReadAtIsNull(profileId);
    }

    public NotificationResponse markRead(UUID profileId, UUID notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notificação não encontrada"));
        if (!n.getProfile().getId().equals(profileId)) {
            throw new AccessDeniedException("Esta notificação não é tua");
        }
        if (n.getReadAt() == null) n.setReadAt(OffsetDateTime.now());
        return NotificationResponse.from(n);
    }

    public int markAllRead(UUID profileId) {
        return notificationRepository.markAllRead(profileId, OffsetDateTime.now());
    }

    // ── Interno ───────────────────────────────────────────────────────────

    private void notify(Profile recipient, NotificationType type, Booking booking, String title,
                        List<String> paragraphs, String ctaLabel, String linkPath) {
        String email = recipient.getEmail();
        boolean sendEmail = sender.isEnabled() && email != null && !email.isBlank();

        Notification n = notificationRepository.save(Notification.builder()
                .profile(recipient)
                .type(type)
                .title(title)
                .body(String.join(" ", paragraphs))
                .linkPath(linkPath)
                .booking(booking)
                .emailStatus(sendEmail ? EmailStatus.PENDING : EmailStatus.SKIPPED)
                .emailError(sendEmail ? null : (sender.isEnabled() ? "sem email" : "email desligado"))
                .build());

        if (sendEmail) {
            String html = renderer.render(NotificationFormat.firstName(recipient.getFullName()), title, paragraphs,
                    ctaLabel, frontendUrl + linkPath);
            events.publishEvent(new EmailRequested(n.getId(), email, title, html));
        }
    }

    private static String period(Booking b) {
        return NotificationFormat.period(b.getStartDate(), b.getEndDate());
    }

    private static String kz(BigDecimal amount) {
        return NotificationFormat.kz(amount);
    }
}
