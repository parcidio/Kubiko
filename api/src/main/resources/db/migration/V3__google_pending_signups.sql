-- ============================================================
-- V3__google_pending_signups.sql
-- Registo via Google em 2 passos: o Google não fornece telefone,
-- e profiles.phone é obrigatório — por isso guardamos os dados
-- do Google temporariamente até o utilizador confirmar o número
-- por OTP (ver GooglePendingSignup / AuthService.registerGoogle).
-- ============================================================

CREATE TABLE google_pending_signups (
    token       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id   TEXT        NOT NULL,
    email       TEXT,
    full_name   TEXT,
    avatar_url  TEXT,
    phone       TEXT,
    role        VARCHAR(20)
                CONSTRAINT chk_google_pending_signups_role
                CHECK (role IN ('OWNER','RENTER','BOTH','ADMIN')),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_google_pending_signups_google_id ON google_pending_signups (google_id);

ALTER TABLE otp_codes DROP CONSTRAINT chk_otp_purpose;
ALTER TABLE otp_codes ADD CONSTRAINT chk_otp_purpose
    CHECK (purpose IN ('REGISTRATION','PASSWORD_RESET','GOOGLE_REGISTRATION'));
