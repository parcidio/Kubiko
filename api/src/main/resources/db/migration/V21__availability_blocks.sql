-- ============================================================
-- V21 — Bloqueios de datas pelo dono (gap #8, ver claude/decisoes-produto.md, 2026-11-11)
--   · intervalos de dias INCLUSIVOS [start_date, end_date]
--   · as datas ocupadas por reservas não se copiam para aqui: calculam-se a partir de bookings
--   · item_availability (V2, um registo por dia, nunca usada) migra para aqui e é removida
-- ============================================================

CREATE TABLE availability_blocks (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID          NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    start_date  DATE          NOT NULL,
    end_date    DATE          NOT NULL,
    note        VARCHAR(200),
    created_by  UUID          REFERENCES profiles(id),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_availability_blocks_range CHECK (end_date >= start_date),
    CONSTRAINT chk_availability_blocks_length CHECK (end_date - start_date <= 365)
);

-- consultas: "bloqueios deste item que acabam a partir de X"
CREATE INDEX idx_availability_blocks_item_end ON availability_blocks(item_id, end_date);

-- Sem perda: cada dia antigo passa a um bloqueio de um dia
INSERT INTO availability_blocks (item_id, start_date, end_date, note, created_at)
SELECT item_id, unavailable_date, unavailable_date, LEFT(reason, 200), created_at
FROM item_availability;

DROP TABLE item_availability;
