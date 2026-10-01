-- ============================================================
-- V2 — Categorias, Items, Fotos e Disponibilidade
-- ============================================================

-- ------------------------------------------------------------
-- 1. Adicionar MODERATOR ao role CHECK existente em profiles
-- ------------------------------------------------------------
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('OWNER', 'RENTER', 'BOTH', 'ADMIN', 'MODERATOR'));


-- ------------------------------------------------------------
-- 2. Categorias (auto-referenciada para suporte a subcategorias)
-- ------------------------------------------------------------
CREATE TABLE categories (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    slug       VARCHAR(100),
    icon_url   TEXT,
    parent_id  UUID        REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 3. Items
-- ------------------------------------------------------------
CREATE TABLE items (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id     UUID           NOT NULL REFERENCES categories(id),
    title           VARCHAR(200)   NOT NULL,
    description     TEXT,
    condition       VARCHAR(20)    NOT NULL CHECK (condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR')),
    price_per_day   NUMERIC(12, 2) NOT NULL,
    deposit_amount  NUMERIC(12, 2),
    province        VARCHAR(100),
    city            VARCHAR(100),
    status          VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE'
                                   CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED')),
    view_count      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_owner_id      ON items(owner_id);
CREATE INDEX idx_items_category_id   ON items(category_id);
CREATE INDEX idx_items_status        ON items(status);

-- trigger updated_at
CREATE TRIGGER set_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
-- 4. Fotos dos items
-- ------------------------------------------------------------
CREATE TABLE item_photos (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id    UUID         NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    photo_url  TEXT         NOT NULL,
    position   INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_photos_item_id ON item_photos(item_id);


-- ------------------------------------------------------------
-- 5. Disponibilidade (datas bloqueadas pelo dono)
-- ------------------------------------------------------------
CREATE TABLE item_availability (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id           UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    unavailable_date  DATE        NOT NULL,
    reason            VARCHAR(50),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (item_id, unavailable_date)
);

CREATE INDEX idx_item_availability_item_id ON item_availability(item_id);


-- ------------------------------------------------------------
-- 6. Seed — categorias raiz
-- ------------------------------------------------------------
INSERT INTO categories (name, slug, icon_url) VALUES
    ('Fotografia', 'fotografia',  null),
    ('Vídeo',      'video',       null),
    ('Áudio',      'audio',       null),
    ('Iluminação', 'iluminacao',  null),
    ('Eventos',    'eventos',     null);