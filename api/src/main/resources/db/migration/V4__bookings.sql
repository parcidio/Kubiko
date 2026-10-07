-- ============================================================
-- V4 — Reservas (bookings)
-- Liga um arrendatário (renter) a um item de um dono (owner)
-- por um período de datas com um preço acordado.
-- ============================================================

CREATE TABLE bookings (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID           NOT NULL REFERENCES items(id),
    renter_id       UUID           NOT NULL REFERENCES profiles(id),
    -- desnormalizado (items.owner_id) para simplificar as queries do dono
    owner_id        UUID           NOT NULL REFERENCES profiles(id),
    start_date      DATE           NOT NULL,
    end_date        DATE           NOT NULL,
    total_price     NUMERIC(12, 2) NOT NULL,
    deposit_amount  NUMERIC(12, 2),
    status          VARCHAR(30)    NOT NULL DEFAULT 'PENDING_OWNER'
                                   CONSTRAINT chk_bookings_status
                                   CHECK (status IN ('PENDING_OWNER', 'ACCEPTED', 'CANCELLED_RENTER',
                                                     'CANCELLED_OWNER', 'ACTIVE', 'COMPLETED', 'DISPUTED')),
    renter_message  TEXT,
    owner_note      TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT chk_bookings_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_bookings_item_id   ON bookings(item_id);
CREATE INDEX idx_bookings_renter_id ON bookings(renter_id);
CREATE INDEX idx_bookings_owner_id  ON bookings(owner_id);
CREATE INDEX idx_bookings_status    ON bookings(status);

-- trigger updated_at
CREATE TRIGGER set_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
