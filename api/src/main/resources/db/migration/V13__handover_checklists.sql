-- ============================================================
-- V13 — Entrega e devolução: estados IN_PROGRESS / RETURNED e checklists com fotos
-- ACTIVE (pago) → IN_PROGRESS (entrega confirmada) → RETURNED (devolução confirmada) → COMPLETED (caução decidida)
-- Uma parte regista (notas + fotos), a OUTRA confirma. Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

ALTER TABLE bookings DROP CONSTRAINT chk_bookings_status;
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status
    CHECK (status IN ('PENDING_OWNER', 'ACCEPTED', 'CANCELLED_RENTER', 'CANCELLED_OWNER',
                      'ACTIVE', 'IN_PROGRESS', 'RETURNED', 'COMPLETED', 'DISPUTED'));

CREATE TABLE checklists (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id    UUID        NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    type          VARCHAR(20) NOT NULL CONSTRAINT chk_checklists_type CHECK (type IN ('DELIVERY', 'RETURN')),
    created_by    UUID        NOT NULL REFERENCES profiles(id),
    notes         TEXT        NOT NULL,
    confirmed_by  UUID        REFERENCES profiles(id),
    confirmed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_checklists_booking_type UNIQUE (booking_id, type),
    -- quem confirma é sempre a outra parte
    CONSTRAINT chk_checklists_other_party CHECK (confirmed_by IS NULL OR confirmed_by <> created_by)
);

CREATE TABLE checklist_photos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id  UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    storage_key   TEXT        NOT NULL UNIQUE,
    content_type  VARCHAR(50) NOT NULL,
    size_bytes    BIGINT      NOT NULL,
    position      INTEGER     NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_photos_checklist_id ON checklist_photos(checklist_id);

-- Tipos de notificação dos módulos de entrega/devolução, caução e problemas
ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type
    CHECK (type IN ('BOOKING_RECEIVED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED',
                    'PAYMENT_CONFIRMED', 'PAYMENT_AWAITING_VALIDATION', 'KYC_SUBMITTED', 'KYC_APPROVED',
                    'KYC_REJECTED', 'KYC_INFO_REQUESTED',
                    'CHECKLIST_TO_CONFIRM', 'BOOKING_IN_PROGRESS', 'BOOKING_RETURNED',
                    'DEPOSIT_RELEASED', 'DEPOSIT_WITHHELD', 'INCIDENT_REPORTED'));
