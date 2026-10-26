package com.beeznoo.api.notification.service;

import com.beeznoo.api.notification.email.ResendEmailSender;
import com.beeznoo.api.notification.entity.EmailStatus;
import com.beeznoo.api.notification.repository.NotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Envia um email e grava o resultado na notificação. Nunca lança: uma falha fica em email_status/email_error.
 * Nos logs só o id da notificação — nem endereço, nem assunto.
 */
@Slf4j
@Service
public class EmailDispatcher {

    private final NotificationRepository notificationRepository;
    private final ResendEmailSender sender;

    public EmailDispatcher(NotificationRepository notificationRepository, ResendEmailSender sender) {
        this.notificationRepository = notificationRepository;
        this.sender = sender;
    }

    @Transactional
    public void deliver(EmailRequested request) {
        notificationRepository.findById(request.notificationId()).ifPresent(notification -> {
            try {
                sender.send(request.to(), request.subject(), request.html(), request.notificationId().toString());
                notification.setEmailStatus(EmailStatus.SENT);
                notification.setEmailedAt(OffsetDateTime.now());
            } catch (RuntimeException e) {
                notification.setEmailStatus(EmailStatus.FAILED);
                notification.setEmailError(e.getMessage());
                log.warn("Notificação {}: email falhou ({})", notification.getId(), e.getMessage());
            }
        });
    }
}
