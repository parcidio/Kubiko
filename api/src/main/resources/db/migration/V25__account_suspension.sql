-- Suspensão de contas pela equipa (decisoes-produto.md 2026-11-15 — ações de admin).
-- suspended_at não nulo = conta suspensa: não entra (login/refresh/Google/2FA) e o equipamento sai do Explorar.
ALTER TABLE profiles
    ADD COLUMN suspended_at      TIMESTAMPTZ,
    ADD COLUMN suspension_reason TEXT,
    ADD COLUMN suspended_by      UUID REFERENCES profiles(id);

ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_suspension_reason
        CHECK (suspended_at IS NULL OR (suspension_reason IS NOT NULL AND length(btrim(suspension_reason)) > 0));

-- Explorar filtra por dono não suspenso; a lista do admin filtra contas suspensas
CREATE INDEX idx_profiles_suspended ON profiles (suspended_at) WHERE suspended_at IS NOT NULL;
