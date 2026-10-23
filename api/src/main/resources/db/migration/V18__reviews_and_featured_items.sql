-- ============================================================
-- V18 — Avaliações e destaques (ver claude/decisoes-produto.md, 2026-10-23)
--   · uma avaliação por reserva concluída, só do arrendatário, imutável
--   · items.featured_at: destaque escolhido pelo admin (NULL = sem destaque)
-- ============================================================

CREATE TABLE reviews (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID          NOT NULL UNIQUE REFERENCES bookings(id),
    item_id      UUID          NOT NULL REFERENCES items(id),
    reviewer_id  UUID          NOT NULL REFERENCES profiles(id),
    owner_id     UUID          NOT NULL REFERENCES profiles(id),
    rating       SMALLINT      NOT NULL CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    comment      VARCHAR(1000),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_item_id  ON reviews(item_id, created_at DESC);
CREATE INDEX idx_reviews_owner_id ON reviews(owner_id);

CREATE OR REPLACE FUNCTION prevent_review_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'reviews não se alteram: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_immutable
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION prevent_review_mutation();

ALTER TABLE items ADD COLUMN featured_at TIMESTAMPTZ;
CREATE INDEX idx_items_featured_at ON items(featured_at DESC) WHERE featured_at IS NOT NULL;

-- "Mais alugados" conta reservas concluídas por item
CREATE INDEX idx_bookings_item_status ON bookings(item_id, status);
