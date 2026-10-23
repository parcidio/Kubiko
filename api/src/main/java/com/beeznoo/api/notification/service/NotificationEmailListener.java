package com.beeznoo.api.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

// Depois do commit e fora do pedido HTTP: o Resend nunca atrasa nem desfaz a operação principal
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEmailListener {

    private final EmailDispatcher dispatcher;

    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void onEmailRequested(EmailRequested request) {
        try {
            dispatcher.deliver(request);
        } catch (RuntimeException e) {
            log.warn("Notificação {}: não foi possível registar o envio ({})",
                    request.notificationId(), e.getClass().getSimpleName());
        }
    }
}
