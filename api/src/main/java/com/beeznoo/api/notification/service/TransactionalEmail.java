package com.beeznoo.api.notification.service;

// Email que não é notificação (ex.: código de verificação). Enviado depois do commit, sem linha em notifications.
public record TransactionalEmail(String to, String subject, String html, String idempotencyKey) {}
