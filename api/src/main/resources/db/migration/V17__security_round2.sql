-- ============================================================
-- V17 — Segurança, 2.ª ronda (ver claude/decisoes-produto.md e docs/SEGURANCA.md)
--   · eventos de segurança · verificação de email · contadores de limites (modo "database")
--   · tipo de notificação SECURITY_ALERT
-- ============================================================

-- Eventos de segurança: sem telefones/emails em claro (identifier_hash = SHA-256), IP guardado para investigação
CREATE TABLE security_events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type             VARCHAR(40) NOT NULL,
    severity         VARCHAR(10) NOT NULL CONSTRAINT chk_security_events_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    -- sem FK de propósito: o evento é gravado numa transação à parte e tem de sobreviver ao perfil
    profile_id       UUID,
    identifier_hash  VARCHAR(64),
    ip               VARCHAR(64),
    request_id       VARCHAR(64),
    details          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_type       ON security_events(type);
CREATE INDEX idx_security_events_profile_id ON security_events(profile_id);

CREATE OR REPLACE FUNCTION prevent_security_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'security_events é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_security_events_append_only
    BEFORE UPDATE OR DELETE ON security_events
    FOR EACH ROW EXECUTE FUNCTION prevent_security_event_mutation();

-- Verificação de email
ALTER TABLE profiles ADD COLUMN email_verified_at TIMESTAMPTZ;

CREATE TABLE email_verifications (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email       VARCHAR(254) NOT NULL,
    code_hash   TEXT         NOT NULL,
    attempts    INTEGER      NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verifications_profile_id ON email_verifications(profile_id);

-- Contadores dos limites de pedidos quando RATE_LIMIT_STORE=database (várias instâncias). Chave em SHA-256.
CREATE TABLE rate_limit_counters (
    key_hash      VARCHAR(64) PRIMARY KEY,
    window_start  TIMESTAMPTZ NOT NULL,
    window_ms     BIGINT      NOT NULL,
    count         INTEGER     NOT NULL
);

CREATE INDEX idx_rate_limit_counters_window_start ON rate_limit_counters(window_start);

-- Alerta de segurança para os admins
ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type
    CHECK (type IN ('BOOKING_RECEIVED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED',
                    'PAYMENT_CONFIRMED', 'PAYMENT_AWAITING_VALIDATION', 'KYC_SUBMITTED', 'KYC_APPROVED',
                    'KYC_REJECTED', 'KYC_INFO_REQUESTED',
                    'CHECKLIST_TO_CONFIRM', 'BOOKING_IN_PROGRESS', 'BOOKING_RETURNED',
                    'DEPOSIT_RELEASED', 'DEPOSIT_WITHHELD', 'INCIDENT_REPORTED',
                    'SECURITY_ALERT'));

-- OTP do 2FA de contas ADMIN
ALTER TABLE otp_codes DROP CONSTRAINT chk_otp_purpose;
ALTER TABLE otp_codes ADD CONSTRAINT chk_otp_purpose
    CHECK (purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'GOOGLE_REGISTRATION', 'ADMIN_LOGIN'));
