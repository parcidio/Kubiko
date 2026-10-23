package com.beeznoo.api.transaction.scheduler;

import com.beeznoo.api.transaction.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Marca EXPIRED as referências em aberto cujo prazo passou. Ver claude/decisoes-produto.md (2026-10-23).
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentExpiryScheduler {

    private final PaymentService paymentService;

    @Scheduled(fixedDelay = 60_000)
    public void expireOverdue() {
        // uma transação por pagamento: uma falha não impede os restantes de expirar
        for (UUID id : paymentService.findOverdueIds()) {
            try {
                paymentService.expire(id);
            } catch (RuntimeException e) {
                log.warn("Falha ao expirar o pagamento {}", id, e);
            }
        }
    }
}
