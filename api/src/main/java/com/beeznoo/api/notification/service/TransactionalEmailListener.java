package com.beeznoo.api.notification.service;

import com.beeznoo.api.notification.email.ResendEmailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

// Depois do commit e fora do pedido. Nunca lança; nos logs nem endereço nem conteúdo.
@Slf4j
@Component
@RequiredArgsConstructor
public class TransactionalEmailListener {

    private final ResendEmailSender sender;

    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void onEmail(TransactionalEmail email) {
        try {
            sender.send(email.to(), email.subject(), email.html(), email.idempotencyKey());
        } catch (RuntimeException e) {
            log.warn("Email transacional falhou ({})", e.getMessage());
        }
    }
}
