-- ============================================================
-- V7 — Ligação dos movimentos do ledger ao pagamento que os originou
-- Nullable: ajustes, devoluções de caução e movimentos anteriores a V7 não têm pagamento.
-- Sem backfill — ledger_entries é append-only (V5). Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

ALTER TABLE ledger_entries
    ADD COLUMN payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT;

CREATE INDEX idx_ledger_entries_payment_id ON ledger_entries(payment_id);

-- Usado pelo PaymentExpiryScheduler a cada minuto
CREATE INDEX idx_payments_open_expires_at ON payments(expires_at) WHERE status = 'AWAITING_PAYMENT';
