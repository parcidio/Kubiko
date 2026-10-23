-- ============================================================
-- V16 — Códigos de uso único do login Google
-- O redirect do OAuth2 deixa de levar tokens na URL: leva um código (60 s, uso único) que o frontend troca
-- por tokens em POST /auth/google/exchange. Só se guarda o SHA-256 do código.
-- Ver claude/decisoes-produto.md (2026-10-23, segurança).
-- ============================================================

CREATE TABLE oauth_login_codes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash   VARCHAR(64) NOT NULL UNIQUE,
    profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_login_codes_expires_at ON oauth_login_codes(expires_at);
