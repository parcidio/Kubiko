-- Foto de perfil enviada pela pessoa (decisoes-produto.md 2026-11-18).
-- Guarda-se no storage privado (B2); a storage_key nunca sai em DTOs: a API devolve uma URL assinada.
-- avatar_url continua a ser a foto do Google (externa) e só se usa quando não há upload.
ALTER TABLE profiles ADD COLUMN avatar_storage_key TEXT;
