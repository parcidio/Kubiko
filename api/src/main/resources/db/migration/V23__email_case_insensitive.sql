-- ============================================================
-- V23 — Emails sem diferença de maiúsculas (ver claude/decisoes-produto.md, 2026-11-11)
--   · normaliza (minúsculas, sem espaços) os emails existentes que não colidem com outra conta
--   · se duas contas só diferem em maiúsculas, ficam como estão (a app já não deixa criar mais) — ver a consulta
--     no fim deste ficheiro para as encontrar
--   · índice em lower(email) para as procuras sem diferença de maiúsculas
-- ============================================================

UPDATE profiles p
SET email = lower(btrim(p.email))
WHERE p.email IS NOT NULL
  AND p.email <> lower(btrim(p.email))
  AND NOT EXISTS (
      SELECT 1 FROM profiles o
      WHERE o.id <> p.id AND lower(btrim(o.email)) = lower(btrim(p.email))
  );

CREATE INDEX idx_profiles_email_lower ON profiles (lower(email));

-- Contas em conflito (correr à mão depois do deploy; resolver com o dono das contas):
--   SELECT lower(email), count(*) FROM profiles WHERE email IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
