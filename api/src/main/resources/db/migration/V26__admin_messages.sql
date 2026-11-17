-- ============================================================
-- V26 — Mensagens da equipa (Admin › Mensagens) — decisoes-produto.md 2026-11-17
-- Só saída (não é chat). Canais: WHATSAPP (Losambo), EMAIL (Resend), SMS (Ombala, só +244).
-- O envio sai depois do commit, em segundo plano; cada destinatário tem uma linha em message_deliveries.
-- ============================================================

CREATE TABLE message_templates (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- chave estável dos modelos predefinidos (NULL nos modelos criados pela equipa)
    key         VARCHAR(60)  UNIQUE,
    name        VARCHAR(80)  NOT NULL,
    -- NULL = serve para qualquer canal
    channel     VARCHAR(10)  CONSTRAINT chk_message_templates_channel CHECK (channel IN ('WHATSAPP','EMAIL','SMS')),
    subject     VARCHAR(150),
    body        TEXT         NOT NULL CONSTRAINT chk_message_templates_body CHECK (length(body) BETWEEN 1 AND 1000),
    predefined  BOOLEAN      NOT NULL DEFAULT false,
    created_by  UUID         REFERENCES profiles(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_message_templates_key CHECK (predefined = (key IS NOT NULL))
);

CREATE TABLE admin_messages (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         VARCHAR(10)  NOT NULL CONSTRAINT chk_admin_messages_channel CHECK (channel IN ('WHATSAPP','EMAIL','SMS')),
    template_id     UUID         REFERENCES message_templates(id) ON DELETE SET NULL,
    subject         VARCHAR(150),
    -- texto com as variáveis ({{nome}}, {{primeiro_nome}}) por substituir
    body            TEXT         NOT NULL CONSTRAINT chk_admin_messages_body CHECK (length(body) BETWEEN 1 AND 1000),
    -- público pedido, ex. {"type":"VERIFIED"} ou {"type":"USERS","userIds":[...]}
    audience        JSONB        NOT NULL,
    audience_label  VARCHAR(120) NOT NULL,
    recipients      INTEGER      NOT NULL CHECK (recipients >= 0),
    created_by      UUID         NOT NULL REFERENCES profiles(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX idx_admin_messages_created_at ON admin_messages (created_at DESC);
-- limite horário de WhatsApp por admin
CREATE INDEX idx_admin_messages_created_by ON admin_messages (created_by, created_at DESC);

CREATE TABLE message_deliveries (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id   UUID         NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
    profile_id   UUID         NOT NULL REFERENCES profiles(id),
    -- telefone ou email no momento do envio (a API devolve-o sempre mascarado)
    destination  VARCHAR(254),
    status       VARCHAR(10)  NOT NULL DEFAULT 'PENDING'
                 CONSTRAINT chk_message_deliveries_status CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
    -- motivo curto (ex.: no_email, foreign_sms, not_on_whatsapp, "Losambo 503"); nunca o conteúdo nem o destino
    error        VARCHAR(200),
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_message_deliveries_recipient UNIQUE (message_id, profile_id)
);

CREATE INDEX idx_message_deliveries_status ON message_deliveries (message_id, status);
CREATE INDEX idx_message_deliveries_profile ON message_deliveries (profile_id);

CREATE TRIGGER trg_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Modelos predefinidos (pt-PT, "tu"). Vocabulário: caução, verificado, em análise — nunca "seguro".
INSERT INTO message_templates (key, name, subject, body, predefined) VALUES
('kyc_incomplete', 'Verificação por terminar', 'Falta pouco para verificares a tua conta',
 'Olá {{primeiro_nome}}, falta pouco para verificares a tua identidade na Beeznoo. Termina a verificação em beeznoo.ao para poderes alugar e publicar equipamento. Leva 2 minutos.',
 true),
('kyc_approved', 'Conta verificada', 'A tua conta está verificada',
 'Olá {{primeiro_nome}}, a tua identidade foi verificada. Já podes pedir equipamento e publicar o teu na Beeznoo.',
 true),
('booking_pending_owner', 'Pedido à espera do dono', 'Tens um pedido de aluguer à espera',
 'Olá {{primeiro_nome}}, tens um pedido de aluguer à espera da tua resposta na Beeznoo. Aceita ou recusa em beeznoo.ao — se não responderes, o pedido expira.',
 true),
('welcome', 'Boas-vindas', 'Que bom ter-te na Beeznoo',
 'Olá {{primeiro_nome}}, que bom ter-te na Beeznoo! Por que comprar quando podes alugar? Encontra equipamento de fotografia, vídeo e eventos em Luanda, de pessoas verificadas.',
 true),
('publish_first_item', 'Publica o teu primeiro equipamento', 'O teu equipamento pode render',
 'Olá {{primeiro_nome}}, tens equipamento de fotografia, vídeo ou eventos parado? Publica-o na Beeznoo e ganha com cada aluguer. A caução fica contigo até à devolução.',
 true),
('area_not_available', 'Ainda não estamos na tua zona', 'Ainda não estamos na tua zona',
 'Olá {{primeiro_nome}}, obrigado por te registares na Beeznoo. Por agora estamos só em Luanda, por isso ainda não podes publicar equipamento na tua zona. Avisamos-te assim que chegarmos aí.',
 true);
