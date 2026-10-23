-- ============================================================
-- V11 — Fotos do equipamento no storage privado (B2)
-- Fotos novas guardam só a storage_key; a URL é assinada a cada resposta (12 h).
-- photo_url fica para URLs externas antigas. Ver claude/decisoes-produto.md (2026-10-23).
-- ============================================================

ALTER TABLE item_photos ALTER COLUMN photo_url DROP NOT NULL;
ALTER TABLE item_photos ADD COLUMN storage_key  TEXT UNIQUE;
ALTER TABLE item_photos ADD COLUMN content_type VARCHAR(50);
ALTER TABLE item_photos ADD COLUMN size_bytes   BIGINT;
ALTER TABLE item_photos ADD CONSTRAINT chk_item_photos_source
    CHECK (photo_url IS NOT NULL OR storage_key IS NOT NULL);
