-- ============================================================
-- V15 — Reportar problema (incident_reports)
-- Dano / perda / roubo / outro, com descrição e fotos (bucket privado). Resolução 100% manual pela equipa;
-- o dinheiro decide-se na caução (deposits). Ver claude/decisoes-produto.md (2026-10-23).
-- Vocabulário: "problema", nunca "sinistro" (CLAUDE.md §8).
-- ============================================================

CREATE TABLE incident_reports (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id       UUID        NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    reporter_id      UUID        NOT NULL REFERENCES profiles(id),
    type             VARCHAR(20) NOT NULL
                                 CONSTRAINT chk_incident_reports_type CHECK (type IN ('DAMAGE', 'LOSS', 'THEFT', 'OTHER')),
    description      TEXT        NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                                 CONSTRAINT chk_incident_reports_status CHECK (status IN ('OPEN', 'RESOLVED')),
    resolution_note  TEXT,
    resolved_by      UUID        REFERENCES profiles(id),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_incident_reports_resolution CHECK (status <> 'RESOLVED' OR resolution_note IS NOT NULL)
);

CREATE INDEX idx_incident_reports_booking_id ON incident_reports(booking_id);
CREATE INDEX idx_incident_reports_status     ON incident_reports(status);

CREATE TRIGGER set_incident_reports_updated_at
    BEFORE UPDATE ON incident_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE incident_photos (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID        NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    storage_key   TEXT        NOT NULL UNIQUE,
    content_type  VARCHAR(50) NOT NULL,
    size_bytes    BIGINT      NOT NULL,
    position      INTEGER     NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_photos_incident_id ON incident_photos(incident_id);
