package com.beeznoo.api.transaction.scheduler;

import com.beeznoo.api.transaction.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Marca EXPIRED as referências em aberto cujo prazo passou. Ver claude/decisoes-produto.md (2026-10-23).
@Slf4j
@Component
// Com várias réplicas da API só uma corre os agendadores (SCHEDULER_ENABLED=true; docs/DEPLOY_VPS.md). As outras
// ficariam a disputar os mesmos locks; o resultado seria igual (cada expiração volta a verificar com a linha
// bloqueada), mas notificações e logs repetidos não valem o risco.
@ConditionalOnProperty(name = "app.scheduler.enabled", havingValue = "true", matchIfMissing = true)
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
