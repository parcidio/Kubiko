package com.beeznoo.api.notification.service;

import java.util.UUID;

// Publicado na transação da operação; o email só sai depois do commit (NotificationEmailListener)
public record EmailRequested(UUID notificationId, String to, String subject, String html) {}
