-- ============================================================
-- V9 — Notificações (histórico na app + estado do email)
-- Uma linha por evento e destinatário, criada na transação da operação que a origina.
-- O email sai depois do commit; o resultado da entrega fica em email_*. Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

CREATE TABLE notifications (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id    UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type          VARCHAR(50)  NOT NULL
                               CONSTRAINT chk_notifications_type
                               CHECK (type IN ('BOOKING_RECEIVED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED',
                                               'BOOKING_CANCELLED', 'PAYMENT_CONFIRMED',
                                               'PAYMENT_AWAITING_VALIDATION', 'KYC_SUBMITTED', 'KYC_APPROVED',
                                               'KYC_REJECTED', 'KYC_INFO_REQUESTED')),
    title         VARCHAR(200) NOT NULL,
    body          TEXT         NOT NULL,
    -- caminho relativo no frontend (ex.: /reservas/{id}); o email junta o FRONTEND_URL
    link_path     VARCHAR(200),
    booking_id    UUID         REFERENCES bookings(id) ON DELETE SET NULL,
    read_at       TIMESTAMPTZ,
    -- SKIPPED: perfil sem email ou email desligado
    email_status  VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                               CONSTRAINT chk_notifications_email_status
                               CHECK (email_status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    -- nunca devolvido pela API
    email_error   TEXT,
    emailed_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_profile_created ON notifications(profile_id, created_at DESC);
CREATE INDEX idx_notifications_profile_unread  ON notifications(profile_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_booking_id      ON notifications(booking_id);
CREATE INDEX idx_notifications_email_status    ON notifications(email_status);
