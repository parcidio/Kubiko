-- ============================================================
-- V8 — Verificação de identidade (KYC)
-- Documentos em storage privado (B2); aqui só a storage_key. Ver claude/decisoes-produto.md (2026-10-23).
-- "Verificado" = verificação mais recente APPROVED. profiles.is_verified continua a ser o telefone.
-- ============================================================

ALTER TABLE profiles
    ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'
        CONSTRAINT chk_profiles_account_type CHECK (account_type IN ('INDIVIDUAL', 'BUSINESS'));

CREATE TABLE kyc_verifications (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    account_type       VARCHAR(20) NOT NULL
                                   CONSTRAINT chk_kyc_account_type CHECK (account_type IN ('INDIVIDUAL', 'BUSINESS')),
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                   CONSTRAINT chk_kyc_status
                                   CHECK (status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'INFO_REQUESTED')),
    submitted_at       TIMESTAMPTZ NOT NULL,
    reviewed_at        TIMESTAMPTZ,
    reviewed_by        UUID        REFERENCES profiles(id),
    rejection_reason   TEXT,
    info_request_note  TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No máximo uma verificação não recusada por perfil (INFO_REQUESTED re-submete na mesma)
CREATE UNIQUE INDEX uq_kyc_verifications_active_per_profile
    ON kyc_verifications(profile_id) WHERE status <> 'REJECTED';
CREATE INDEX idx_kyc_verifications_profile_id ON kyc_verifications(profile_id);
CREATE INDEX idx_kyc_verifications_status     ON kyc_verifications(status);

CREATE TRIGGER set_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ficheiros: uma linha por envio (uma re-submissão acrescenta, não substitui)
CREATE TABLE kyc_documents (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id         UUID        NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    document_type  VARCHAR(30) NOT NULL
                               CONSTRAINT chk_kyc_documents_type
                               CHECK (document_type IN ('BI_FRONT', 'BI_BACK', 'SELFIE', 'NIF_DOCUMENT', 'BUSINESS_DOCUMENT')),
    -- nunca exposta na API nem nos logs
    storage_key    TEXT        NOT NULL UNIQUE,
    content_type   VARCHAR(50) NOT NULL,
    size_bytes     BIGINT      NOT NULL CONSTRAINT chk_kyc_documents_size CHECK (size_bytes > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_documents_kyc_id ON kyc_documents(kyc_id);

-- Histórico de decisões: quem fez o quê e quando (append-only)
CREATE TABLE kyc_decisions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id      UUID        NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    -- admin (START_REVIEW/APPROVE/REJECT/REQUEST_INFO) ou o próprio utilizador (RESUBMIT)
    actor_id    UUID        NOT NULL REFERENCES profiles(id),
    action      VARCHAR(20) NOT NULL
                            CONSTRAINT chk_kyc_decisions_action
                            CHECK (action IN ('START_REVIEW', 'APPROVE', 'REJECT', 'REQUEST_INFO', 'RESUBMIT')),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_decisions_kyc_id ON kyc_decisions(kyc_id);

CREATE OR REPLACE FUNCTION prevent_kyc_decision_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'kyc_decisions é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kyc_decisions_append_only
    BEFORE UPDATE OR DELETE ON kyc_decisions
    FOR EACH ROW EXECUTE FUNCTION prevent_kyc_decision_mutation();
