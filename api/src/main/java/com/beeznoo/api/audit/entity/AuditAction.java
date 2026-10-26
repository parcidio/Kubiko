package com.beeznoo.api.audit.entity;

public enum AuditAction {
    KYC_START_REVIEW,
    KYC_APPROVED,
    KYC_REJECTED,
    KYC_INFO_REQUESTED,
    KYC_DOCUMENTS_VIEWED,       // admin abriu os documentos (URLs assinadas) de uma verificação
    PAYMENT_CONFIRMED_MANUALLY,
    BALANCE_ADJUSTED,
    DEPOSIT_RELEASED,
    DEPOSIT_WITHHELD,
    BOOKING_COMPLETED,
    INCIDENT_RESOLVED,
    ITEM_FEATURED,
    ITEM_UNFEATURED
}
