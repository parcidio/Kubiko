-- ============================================================
-- V24 — Pagamento direto ao dono (modelo "Yango"), ver claude/decisoes-produto.md (2026-11-15)
--   · método DIRECT: o arrendatário paga ao dono na entrega e o dono confirma na app
--     (provider = meio usado: CASH, TRANSFER ou MULTICAIXA_EXPRESS)
--   · quem confirmou (dono ou admin em nome dele)
--   · a taxa de serviço é dívida do dono até a equipa registar que a recebeu
-- ============================================================

ALTER TABLE payments DROP CONSTRAINT chk_payments_method;
ALTER TABLE payments ADD CONSTRAINT chk_payments_method CHECK (method IN ('REFERENCE', 'MANUAL', 'DIRECT'));

ALTER TABLE payments
    ADD COLUMN confirmed_by           UUID REFERENCES profiles(id),
    ADD COLUMN commission_settled_at  TIMESTAMPTZ,
    ADD COLUMN commission_settled_by  UUID REFERENCES profiles(id);

-- só um pagamento confirmado por reserva (também protege o duplo clique do dono)
CREATE UNIQUE INDEX uq_payments_confirmed_per_booking ON payments(booking_id) WHERE status = 'CONFIRMED';

-- comissões por receber (fila do admin e Carteira do dono)
CREATE INDEX idx_payments_commission_due ON payments(confirmed_at)
    WHERE method = 'DIRECT' AND status = 'CONFIRMED' AND commission_settled_at IS NULL;

ALTER TABLE payments ADD CONSTRAINT chk_payments_commission_settled
    CHECK (commission_settled_at IS NULL OR (method = 'DIRECT' AND status = 'CONFIRMED'));
