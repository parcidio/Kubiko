package com.beeznoo.api.booking.scheduler;

import com.beeznoo.api.booking.service.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Marca EXPIRED os pedidos sem resposta do dono no prazo. Ver claude/decisoes-produto.md (2026-11-11, gap #11).
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingExpiryScheduler {

    private final BookingService bookingService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void expireOverdue() {
        // uma transação por pedido: uma falha não impede os restantes de expirar
        for (UUID id : bookingService.findOverduePendingIds()) {
            try {
                bookingService.expire(id);
            } catch (RuntimeException e) {
                log.warn("Falha ao expirar o pedido {}", id, e);
            }
        }
    }
}
