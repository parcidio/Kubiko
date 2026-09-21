-- ============================================================
-- V1__init_profiles_accounts.sql
-- Auth: OTP via WhatsApp (principal) + Google OAuth (opcional)
-- Sem password — o OTP é o único fator de autenticação
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name    TEXT        NOT NULL,
    phone        TEXT        NOT NULL UNIQUE,
    email        TEXT        UNIQUE,
    google_id    TEXT        UNIQUE,
    avatar_url   TEXT,
    province     TEXT,
    city         TEXT,
    role         VARCHAR(20) NOT NULL DEFAULT 'RENTER'
                    CONSTRAINT chk_profiles_role
                    CHECK (role IN ('OWNER','RENTER','BOTH','ADMIN')),
    is_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    rating_avg   NUMERIC(3,2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_phone     ON profiles (phone);
CREATE INDEX idx_profiles_google_id ON profiles (google_id);
CREATE INDEX idx_profiles_role      ON profiles (role);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID          NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    available_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    held_balance      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'AOA',
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_accounts_available_balance CHECK (available_balance >= 0),
    CONSTRAINT chk_accounts_held_balance      CHECK (held_balance >= 0)
);

CREATE INDEX idx_accounts_profile_id ON accounts (profile_id);

-- ============================================================
-- OTP_CODES
-- Código temporário enviado via WhatsApp — guardado como hash
-- ============================================================
CREATE TABLE otp_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       TEXT        NOT NULL,
    code_hash   TEXT        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_phone ON otp_codes (phone);

-- ============================================================
-- REFRESH_TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash     TEXT        NOT NULL UNIQUE,
    expires_at     TIMESTAMPTZ NOT NULL,
    revoked_at     TIMESTAMPTZ,
    created_by_ip  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_profile_id ON refresh_tokens (profile_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();