-- ============================================================
-- V12 — Contrato por reserva
-- Gerado quando o dono aceita (aceitar = aceitação do dono). O arrendatário aceita antes de pagar.
-- O texto fica congelado com versão e SHA-256. Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

CREATE TABLE contracts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID        NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    version             VARCHAR(20) NOT NULL,
    body                TEXT        NOT NULL,
    body_sha256         VARCHAR(64) NOT NULL,
    owner_accepted_at   TIMESTAMPTZ NOT NULL,
    renter_accepted_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O texto e o hash nunca mudam depois de gerados
CREATE OR REPLACE FUNCTION prevent_contract_body_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.body <> OLD.body OR NEW.body_sha256 <> OLD.body_sha256 OR NEW.version <> OLD.version THEN
        RAISE EXCEPTION 'contracts: o texto do contrato não pode ser alterado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contracts_body_immutable
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION prevent_contract_body_change();
