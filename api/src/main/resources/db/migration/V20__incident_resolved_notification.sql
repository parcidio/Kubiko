-- ============================================================
-- V20 — Notificação "problema resolvido" para as partes da reserva (ver claude/decisoes-produto.md, 2026-11-11)
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type
    CHECK (type IN ('BOOKING_RECEIVED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED',
                    'PAYMENT_CONFIRMED', 'PAYMENT_AWAITING_VALIDATION', 'KYC_SUBMITTED', 'KYC_APPROVED',
                    'KYC_REJECTED', 'KYC_INFO_REQUESTED',
                    'CHECKLIST_TO_CONFIRM', 'BOOKING_IN_PROGRESS', 'BOOKING_RETURNED',
                    'DEPOSIT_RELEASED', 'DEPOSIT_WITHHELD', 'INCIDENT_REPORTED', 'INCIDENT_RESOLVED',
                    'SECURITY_ALERT'));
