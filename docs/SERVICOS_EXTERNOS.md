# Serviços externos — contas e configuração

Estado a 2026-10-23. Como passar cada serviço das contas pessoais da equipa para contas do projeto, e o que tem de
estar configurado em staging e produção. Variáveis em `.env.example`; controlos de segurança em `docs/SEGURANCA.md`.

## Regras comuns

- Conta do **projeto** (email `@beeznoo.ao` partilhado pelo André), nunca a conta pessoal de quem a criou.
- 2FA ligado em todas as contas; pelo menos **duas pessoas** com acesso de administração (o André + uma).
- Uma chave/credencial **por ambiente** (local, staging, produção), com o mínimo de permissões. Nunca reutilizar.
- Segredos só nas variáveis do Render/Vercel e nos `.env` locais — nunca no Git, Slack ou WhatsApp.
- Ao passar de uma conta pessoal para a do projeto: criar credenciais novas, trocar no Render/Vercel, **apagar as antigas**.

## Serviços

| Serviço | Para quê | Variáveis | Configuração obrigatória |
|---|---|---|---|
| **Neon** | Postgres | `DB_*` | Connection string *pooled*; um branch por ambiente; utilizador da app sem permissões de dono da BD em produção |
| **Render** | API Spring | todas as do backend | `SESSION_COOKIE_SECURE=true`, `API_DOCS_ENABLED=false`, `PAYMENTS_AUTO_CONFIRM=false`, `ADMIN_MFA_ENABLED=true`, `RATE_LIMIT_TRUSTED_PROXIES=2`; `JWT_SECRET` com `openssl rand -base64 64`, diferente por ambiente |
| **Vercel** | Frontend Next | `API_URL` | Previews por PR apontam para staging, nunca para produção |
| **Backblaze B2** | KYC, fotos, checklists, problemas | `B2_*` | Bucket **privado** por ambiente; chave de aplicação restrita a esse bucket; encriptação do lado do servidor ligada |
| **Resend** | Email | `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFICATIONS_EMAIL_ENABLED` | Domínio `beeznoo.ao` verificado (SPF, DKIM, DMARC); chave só com permissão de envio |
| **Google Cloud** | Login Google | `GOOGLE_CLIENT_*` | Projeto do Beeznoo; *redirect URIs* só dos domínios reais (`…/login/oauth2/code/google`); ecrã de consentimento publicado |
| **Ombala** | SMS (OTP e 2FA de admin) | `OMBALA_TOKEN`, `OMBALA_SENDER` | Remetente `Beeznoo`; alerta de saldo baixo (sem saldo não há login de admin) |
| **GitHub** | Repo e CI | — | Proteção de `main` com os checks `build`, `frontend`, `secrets`, `deps` e 1 review obrigatórios; Dependabot alerts ligados |

## Teste manual do bucket (antes de fazer merge de uma atualização do AWS SDK)

O B2 não suporta tudo o que o SDK envia por omissão (ver `B2StorageService`). Em staging, depois do deploy do PR:

1. Enviar uma foto de equipamento e um documento KYC (PDF).
2. Abrir os dois pelas URLs assinadas (têm de abrir e expirar ao fim de `APP_STORAGE_SIGNED_URL_TTL`).
3. Apagar a foto e confirmar no painel do B2 que o ficheiro desapareceu.

Se algum passo falhar, não fazer merge.
