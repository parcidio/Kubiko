-- ============================================================
-- V27 — Zonas de serviço (piloto Luanda) e localização com consentimento
-- decisoes-produto.md 2026-11-17 (itens 4–6) · contrato docs/API_ADMIN_MESSAGES_GEO.md
-- Coordenadas de pessoas guardadas só ARREDONDADAS a 2 casas decimais (~1 km): NUMERIC(5,2) arredonda
-- na própria BD, mesmo que o código se esqueça. Nunca se guarda a posição exata.
-- A localização vem do browser e pode ser falsificada: controlo de produto, não de segurança.
-- ============================================================

-- Zonas onde se pode publicar equipamento. Sem DELETE: desativa-se (active = false).
CREATE TABLE service_areas (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    province    VARCHAR(100)  NOT NULL,
    city        VARCHAR(100)  NOT NULL,
    -- centro da zona (não é de uma pessoa: pode ter mais precisão)
    center_lat  NUMERIC(8,5)  NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
    center_lng  NUMERIC(8,5)  NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
    radius_km   INTEGER       NOT NULL CHECK (radius_km BETWEEN 1 AND 500),
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_service_areas_province_city ON service_areas (lower(province), lower(city));

-- Piloto: Luanda (60 km) e Bengo/Caxito (60 km) — decisão do PM de 2026-11-17 (Bengo conta no piloto)
INSERT INTO service_areas (province, city, center_lat, center_lng, radius_km, active)
VALUES ('Luanda', 'Luanda', -8.83900, 13.28940, 60, TRUE),
       ('Bengo',  'Caxito', -8.57850, 13.66430, 60, TRUE);

-- Última localização conhecida e as do registo e do KYC (todas arredondadas a ~1 km)
ALTER TABLE profiles
    ADD COLUMN last_lat            NUMERIC(5,2) CHECK (last_lat BETWEEN -90 AND 90),
    ADD COLUMN last_lng            NUMERIC(5,2) CHECK (last_lng BETWEEN -180 AND 180),
    ADD COLUMN last_location_at    TIMESTAMPTZ,
    ADD COLUMN location_consent_at TIMESTAMPTZ,
    ADD COLUMN signup_lat          NUMERIC(5,2) CHECK (signup_lat BETWEEN -90 AND 90),
    ADD COLUMN signup_lng          NUMERIC(5,2) CHECK (signup_lng BETWEEN -180 AND 180),
    ADD COLUMN kyc_lat             NUMERIC(5,2) CHECK (kyc_lat BETWEEN -90 AND 90),
    ADD COLUMN kyc_lng             NUMERIC(5,2) CHECK (kyc_lng BETWEEN -180 AND 180),
    -- NULL = nunca enviou localização
    ADD COLUMN in_service_area     BOOLEAN;

-- Histórico de localizações enviadas (registo, KYC, cada tentativa de publicar, app). Append-only: nunca se altera.
-- Retenção máxima de 12 meses (PM, 2026-11-17): LocationRetentionScheduler apaga as linhas antigas, por isso
-- o trigger bloqueia só UPDATE (DELETE fica permitido para a limpeza).
CREATE TABLE location_events (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES profiles(id),
    context     VARCHAR(10)   NOT NULL CHECK (context IN ('SIGNUP', 'KYC', 'PUBLISH', 'APP')),
    lat         NUMERIC(5,2)  NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         NUMERIC(5,2)  NOT NULL CHECK (lng BETWEEN -180 AND 180),
    in_area     BOOLEAN       NOT NULL,
    area_id     UUID          REFERENCES service_areas(id),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_location_events_user    ON location_events (user_id, created_at DESC);
CREATE INDEX idx_location_events_context ON location_events (context, created_at DESC);
CREATE INDEX idx_location_events_created ON location_events (created_at);

CREATE OR REPLACE FUNCTION prevent_location_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'location_events é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_location_events_append_only
    BEFORE UPDATE ON location_events
    FOR EACH ROW EXECUTE FUNCTION prevent_location_event_mutation();
