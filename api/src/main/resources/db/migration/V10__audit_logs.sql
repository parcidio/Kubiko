-- ============================================================
-- V10 — Registo de auditoria (audit_logs)
-- Ações sensíveis de admin (CLAUDE.md §6). Append-only: correções são novas entradas.
-- metadata: só ids, estados e montantes — nunca BI, NIF, referências de pagamento ou storage keys.
-- ============================================================

CREATE TABLE audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL = sistema (ex.: agendador)
    actor_id     UUID        REFERENCES profiles(id),
    action       VARCHAR(50) NOT NULL,
    entity_type  VARCHAR(30) NOT NULL,
    entity_id    UUID        NOT NULL,
    reason       TEXT,
    metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor_id   ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
