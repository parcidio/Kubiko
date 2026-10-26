package com.beeznoo.api.notification.entity;

public enum NotificationType {
    BOOKING_RECEIVED,            // → dono: novo pedido
    BOOKING_ACCEPTED,            // → arrendatário
    BOOKING_REJECTED,            // → arrendatário: dono recusou um pedido PENDING_OWNER
    BOOKING_CANCELLED,           // → a outra parte
    PAYMENT_CONFIRMED,           // → arrendatário e dono
    PAYMENT_AWAITING_VALIDATION, // → admins: "Já paguei" sem confirmação do gateway
    KYC_SUBMITTED,               // → admins
    KYC_APPROVED,
    KYC_REJECTED,
    KYC_INFO_REQUESTED,
    CHECKLIST_TO_CONFIRM,        // → a outra parte: confirmar entrega/devolução
    BOOKING_IN_PROGRESS,         // → ambos: entrega confirmada
    BOOKING_RETURNED,            // → admins: caução a decidir
    DEPOSIT_RELEASED,            // → arrendatário
    DEPOSIT_WITHHELD,            // → arrendatário e dono
    INCIDENT_REPORTED,           // → admins
    SECURITY_ALERT               // → admins: refresh roubado, 2FA de admin bloqueado
}
