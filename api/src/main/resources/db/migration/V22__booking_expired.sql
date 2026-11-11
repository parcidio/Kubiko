-- ============================================================
-- V22 — Pedido sem resposta expira (gap #11, ver claude/decisoes-produto.md, 2026-11-11)
--   · estado EXPIRED nas reservas
--   · notificação BOOKING_EXPIRED
-- ============================================================

ALTER TABLE bookings DROP CONSTRAINT chk_bookings_status;
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status
    CHECK (status IN ('PENDING_OWNER', 'ACCEPTED', 'CANCELLED_RENTER', 'CANCELLED_OWNER', 'EXPIRED',
                      'ACTIVE', 'IN_PROGRESS', 'RETURNED', 'COMPLETED', 'DISPUTED'));

-- o agendador procura pedidos pendentes antigos
CREATE INDEX idx_bookings_pending_created ON bookings(created_at) WHERE status = 'PENDING_OWNER';

ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type
    CHECK (type IN ('BOOKING_RECEIVED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_EXPIRED',
                    'PAYMENT_CONFIRMED', 'PAYMENT_AWAITING_VALIDATION', 'KYC_SUBMITTED', 'KYC_APPROVED',
                    'KYC_REJECTED', 'KYC_INFO_REQUESTED',
                    'CHECKLIST_TO_CONFIRM', 'BOOKING_IN_PROGRESS', 'BOOKING_RETURNED',
                    'DEPOSIT_RELEASED', 'DEPOSIT_WITHHELD', 'INCIDENT_REPORTED', 'INCIDENT_RESOLVED',
                    'SECURITY_ALERT'));
