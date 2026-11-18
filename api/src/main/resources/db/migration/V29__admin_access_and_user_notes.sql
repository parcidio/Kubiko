-- ============================================================
-- V29 — Acesso ao Admin por convite, papéis da equipa e notas internas
-- decisoes-produto.md 2026-11-18
-- ============================================================

-- Papel dentro da equipa. Só existe para role = 'ADMIN'; as permissões vêm daqui em cada pedido.
ALTER TABLE profiles ADD COLUMN admin_role VARCHAR(20);

-- Os admins que já existem ficam SUPER_ADMIN (eram admins com acesso total)
UPDATE profiles SET admin_role = 'SUPER_ADMIN' WHERE role = 'ADMIN';

ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_admin_role
        CHECK (admin_role IS NULL
               OR (role = 'ADMIN' AND admin_role IN ('SUPER_ADMIN', 'OPERATIONS', 'TRUST', 'GROWTH')));

CREATE INDEX idx_profiles_admin_role ON profiles (admin_role) WHERE admin_role IS NOT NULL;

-- Convites para a equipa: token só em hash (SHA-256), uso único, com validade.
-- Alvo: uma conta existente (profile_id) ou um email (o convidado entra com esse email já confirmado).
CREATE TABLE admin_invitations (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID         REFERENCES profiles(id) ON DELETE CASCADE,
    email        VARCHAR(255),
    admin_role   VARCHAR(20)  NOT NULL
                              CONSTRAINT chk_admin_invitations_role
                              CHECK (admin_role IN ('SUPER_ADMIN', 'OPERATIONS', 'TRUST', 'GROWTH')),
    token_hash   VARCHAR(64)  NOT NULL UNIQUE,
    note         VARCHAR(500),
    invited_by   UUID         NOT NULL REFERENCES profiles(id),
    expires_at   TIMESTAMPTZ  NOT NULL,
    accepted_at  TIMESTAMPTZ,
    accepted_by  UUID         REFERENCES profiles(id),
    revoked_at   TIMESTAMPTZ,
    revoked_by   UUID         REFERENCES profiles(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_admin_invitations_target CHECK (profile_id IS NOT NULL OR email IS NOT NULL),
    CONSTRAINT chk_admin_invitations_email CHECK (email IS NULL OR email = lower(email)),
    CONSTRAINT chk_admin_invitations_final CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX idx_admin_invitations_created_at ON admin_invitations (created_at DESC);
CREATE INDEX idx_admin_invitations_profile ON admin_invitations (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_admin_invitations_email ON admin_invitations (email) WHERE email IS NOT NULL;

-- Notas internas da equipa sobre uma conta. Sem UPDATE (como audit_logs): corrige-se com uma nota nova.
CREATE TABLE admin_user_notes (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id   UUID         NOT NULL REFERENCES profiles(id),
    body        TEXT         NOT NULL CONSTRAINT chk_admin_user_notes_body CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_user_notes_profile ON admin_user_notes (profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION admin_user_notes_no_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'admin_user_notes não se altera: acrescenta uma nota nova';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_user_notes_no_update
    BEFORE UPDATE ON admin_user_notes
    FOR EACH ROW EXECUTE FUNCTION admin_user_notes_no_update();

-- Lista de utilizadores do Admin: ordenar por data de registo
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles (created_at DESC);
