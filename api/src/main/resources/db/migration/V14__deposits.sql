-- ============================================================
-- V14 — Cauções (deposits), opção B do SPEC §8
-- Estado da caução de cada reserva paga; os movimentos de dinheiro continuam no ledger.
-- HELD → RELEASED (tudo devolvido) | WITHHELD (parte ou tudo retido a favor do dono; o resto volta).
-- Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

CREATE TABLE deposits (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id       UUID           NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    amount           NUMERIC(12, 2) NOT NULL CONSTRAINT chk_deposits_amount CHECK (amount > 0),
    status           VARCHAR(20)    NOT NULL DEFAULT 'HELD'
                                    CONSTRAINT chk_deposits_status CHECK (status IN ('HELD', 'RELEASED', 'WITHHELD')),
    withheld_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason           TEXT,
    decided_by       UUID           REFERENCES profiles(id),
    held_at          TIMESTAMPTZ    NOT NULL,
    decided_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_deposits_withheld CHECK (withheld_amount >= 0 AND withheld_amount <= amount),
    CONSTRAINT chk_deposits_withheld_reason CHECK (status <> 'WITHHELD' OR (withheld_amount > 0 AND reason IS NOT NULL))
);

CREATE INDEX idx_deposits_status ON deposits(status);

CREATE TRIGGER set_deposits_updated_at
    BEFORE UPDATE ON deposits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Backfill: cauções já retidas no ledger antes desta migração
INSERT INTO deposits (booking_id, amount, status, withheld_amount, reason, held_at, decided_at)
SELECT h.booking_id,
       h.amount,
       CASE WHEN f.amount IS NOT NULL THEN 'WITHHELD'
            WHEN r.amount IS NOT NULL THEN 'RELEASED'
            ELSE 'HELD' END,
       COALESCE(f.amount, 0),
       CASE WHEN f.amount IS NOT NULL THEN 'Migrado do ledger (V14)' END,
       h.created_at,
       COALESCE(f.created_at, r.created_at)
FROM ledger_entries h
LEFT JOIN ledger_entries f ON f.booking_id = h.booking_id AND f.type = 'DEPOSIT_FORFEIT'
LEFT JOIN ledger_entries r ON r.booking_id = h.booking_id AND r.type = 'DEPOSIT_RETURN'
WHERE h.type = 'DEPOSIT_HOLD' AND h.booking_id IS NOT NULL;
