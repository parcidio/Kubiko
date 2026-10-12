-- ============================================================
-- V5 — Ledger de movimentos (ledger_entries)
-- Registo append-only de todos os movimentos de saldo das contas.
-- Nunca se faz UPDATE nem DELETE: correcções são novas entradas (ADJUSTMENT).
-- ============================================================

CREATE TABLE ledger_entries (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID           NOT NULL REFERENCES accounts(id),
    -- nullable: ajustes manuais do admin não estão ligados a uma reserva
    booking_id     UUID           REFERENCES bookings(id),
    type           VARCHAR(30)    NOT NULL
                                  CONSTRAINT chk_ledger_entries_type
                                  CHECK (type IN ('HOLD', 'HOLD_RELEASE', 'PAYMENT_DEBIT', 'PAYMENT_CREDIT',
                                                  'DEPOSIT_HOLD', 'DEPOSIT_RETURN', 'DEPOSIT_FORFEIT',
                                                  'ADJUSTMENT')),
    amount         NUMERIC(12, 2) NOT NULL
                                  CONSTRAINT chk_ledger_entries_amount CHECK (amount > 0),
    -- snapshot do saldo disponível da conta após o movimento
    balance_after  NUMERIC(12, 2) NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_booking_id ON ledger_entries(booking_id);
CREATE INDEX idx_ledger_entries_type       ON ledger_entries(type);

-- ============================================================
-- Append-only: bloqueia UPDATE e DELETE ao nível da base de dados
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entries_append_only
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
