-- ============================================================
-- V6 — Pagamentos por referência (payments)
-- 1:N com bookings: trilho de tentativas (referências expiradas, canceladas, confirmadas).
-- Ver claude/decisoes-produto.md (2026-10-16).
-- ============================================================

CREATE TABLE payments (
    id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id               UUID           NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    renter_id                UUID           NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    method                   VARCHAR(20)    NOT NULL
                                            CONSTRAINT chk_payments_method CHECK (method IN ('REFERENCE', 'MANUAL')),
    -- quem emitiu/validou: SIMULATED hoje, EMIS no futuro, MANUAL quando o admin valida
    provider                 VARCHAR(30)    NOT NULL,
    -- entidade + referência Multicaixa; nulos num pagamento MANUAL
    entity                   VARCHAR(10),
    reference                VARCHAR(20),
    rental_amount            NUMERIC(12, 2) NOT NULL CONSTRAINT chk_payments_rental CHECK (rental_amount > 0),
    service_fee              NUMERIC(12, 2) NOT NULL DEFAULT 0 CONSTRAINT chk_payments_fee CHECK (service_fee >= 0),
    deposit_amount           NUMERIC(12, 2) NOT NULL DEFAULT 0 CONSTRAINT chk_payments_deposit CHECK (deposit_amount >= 0),
    amount                   NUMERIC(12, 2) NOT NULL,
    status                   VARCHAR(30)    NOT NULL DEFAULT 'AWAITING_PAYMENT'
                                            CONSTRAINT chk_payments_status
                                            CHECK (status IN ('AWAITING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'FAILED')),
    provider_transaction_id  VARCHAR(100),
    expires_at               TIMESTAMPTZ    NOT NULL,
    confirmed_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT chk_payments_amount CHECK (amount = rental_amount + service_fee + deposit_amount)
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_renter_id  ON payments(renter_id);
CREATE INDEX idx_payments_status     ON payments(status);

-- No máximo uma referência em aberto por reserva
CREATE UNIQUE INDEX uq_payments_open_per_booking ON payments(booking_id) WHERE status = 'AWAITING_PAYMENT';
-- Uma referência nunca se repete dentro da mesma entidade
CREATE UNIQUE INDEX uq_payments_entity_reference ON payments(entity, reference) WHERE reference IS NOT NULL;

CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Ledger: novos tipos para a liquidação do pagamento
--   TOPUP       — valor recebido pela referência entra no saldo do arrendatário
--   SERVICE_FEE — taxa de serviço Beeznoo debitada ao arrendatário
-- ============================================================
ALTER TABLE ledger_entries DROP CONSTRAINT chk_ledger_entries_type;
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_entries_type
    CHECK (type IN ('HOLD', 'HOLD_RELEASE', 'PAYMENT_DEBIT', 'PAYMENT_CREDIT',
                    'DEPOSIT_HOLD', 'DEPOSIT_RETURN', 'DEPOSIT_FORFEIT',
                    'ADJUSTMENT', 'TOPUP', 'SERVICE_FEE'));
