-- ============================================================
-- V19 — Número do comprovativo de pagamento (ver claude/decisoes-produto.md, 2026-11-11)
--   · payments.receipt_number: "CP <ano>/<6 dígitos>", atribuído quando o pagamento é confirmado
--   · sequência única (não reinicia por ano): nunca há dois comprovativos com o mesmo número
--   · documento NÃO fiscal — faturas e recibos fiscais exigem software certificado pela AGT
-- ============================================================

CREATE SEQUENCE payment_receipt_seq START 1;

ALTER TABLE payments ADD COLUMN receipt_number VARCHAR(30);

-- Backfill: pagamentos já confirmados, por ordem de confirmação
WITH numbered AS (
    SELECT id, confirmed_at, nextval('payment_receipt_seq') AS n
    FROM (SELECT id, confirmed_at FROM payments
          WHERE status = 'CONFIRMED'
          ORDER BY confirmed_at, created_at, id) ordered
)
UPDATE payments p
SET receipt_number = 'CP ' || EXTRACT(YEAR FROM COALESCE(n.confirmed_at, now()) AT TIME ZONE 'Africa/Luanda')::int
                     || '/' || LPAD(n.n::text, 6, '0')
FROM numbered n
WHERE p.id = n.id;

CREATE UNIQUE INDEX uq_payments_receipt_number ON payments(receipt_number) WHERE receipt_number IS NOT NULL;

-- Confirmado ⇒ tem número (um estado futuro, p. ex. reembolsado, mantém o número)
ALTER TABLE payments ADD CONSTRAINT chk_payments_receipt_number
    CHECK (status <> 'CONFIRMED' OR receipt_number IS NOT NULL);
